"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { KDSTicket } from "@/modules/kds/domain/kds";

export type ConnectionStatus = "CONNECTING" | "ONLINE" | "RECONNECTING" | "OFFLINE";

interface UseKDSStreamOptions {
  branchId: string;
  stationId?: string | null;
  onNewTicket?: (ticket: KDSTicket) => void;
}

export function useKDSStream({ branchId, stationId, onNewTicket }: UseKDSStreamOptions) {
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("CONNECTING");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef<number>(1000);
  const isMountedRef = useRef<boolean>(true);
  const knownTicketIdsRef = useRef<Set<string>>(new Set());

  // Manual / polling fetch tickets from REST API
  const fetchTicketsRest = useCallback(async () => {
    try {
      let url = `/api/v1/kds/tickets?branchId=${encodeURIComponent(branchId)}`;
      if (stationId) {
        url += `&stationId=${encodeURIComponent(stationId)}`;
      }

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (Array.isArray(data.tickets) && isMountedRef.current) {
        setTickets(data.tickets);
        setLastSyncAt(new Date());

        const ids = new Set<string>();
        for (const t of data.tickets) {
          ids.add(t.id);
        }
        knownTicketIdsRef.current = ids;
      }
    } catch (err) {
      console.warn("KDS REST sync error:", err);
    }
  }, [branchId, stationId]);

  // Connect to SSE stream via single-use ephemeral ticket
  const connectSSE = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      setConnectionStatus((prev) => (prev === "ONLINE" ? "RECONNECTING" : "CONNECTING"));

      // 1. Issue ephemeral ticket
      const ticketRes = await fetch("/api/v1/realtime/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          stationId: stationId || undefined,
        }),
      });

      if (!ticketRes.ok) {
        throw new Error("Failed to acquire ephemeral realtime ticket");
      }

      const ticketData = await ticketRes.json();
      const token = ticketData.ticket;

      if (!isMountedRef.current) return;

      // 2. Open EventSource
      const streamUrl = `/api/v1/kds/stream?ticket=${encodeURIComponent(token)}`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.addEventListener("connected", () => {
        if (!isMountedRef.current) return;
        setConnectionStatus("ONLINE");
        backoffRef.current = 1000; // Reset backoff on successful connection
      });

      es.addEventListener("initial_state", (e: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const parsed = JSON.parse(e.data);
          if (Array.isArray(parsed.tickets)) {
            setTickets(parsed.tickets);
            setLastSyncAt(new Date());
            const ids = new Set<string>();
            for (const t of parsed.tickets) {
              ids.add(t.id);
            }
            knownTicketIdsRef.current = ids;
          }
        } catch (err) {
          console.error("Error parsing initial_state:", err);
        }
      });

      es.addEventListener("ticket_updated", (e: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const parsed = JSON.parse(e.data);
          const { eventType, ticket, ticketId } = parsed;

          setLastSyncAt(new Date());

          if (eventType === "KDSTicketBumped") {
            // Remove bumped ticket from active display
            const targetId = ticketId || ticket?.id;
            setTickets((prev) => prev.filter((t) => t.id !== targetId));
            knownTicketIdsRef.current.delete(targetId);
            return;
          }

          if (ticket) {
            const isNew = !knownTicketIdsRef.current.has(ticket.id);
            if (isNew && ticket.status !== "COMPLETED") {
              onNewTicket?.(ticket);
              knownTicketIdsRef.current.add(ticket.id);
            }

            setTickets((prev) => {
              const existingIdx = prev.findIndex((t) => t.id === ticket.id);
              if (existingIdx !== -1) {
                // Deduplicate if incoming ticket is not newer
                const existing = prev[existingIdx];
                if (new Date(ticket.updated_at).getTime() < new Date(existing.updated_at).getTime()) {
                  return prev;
                }
                const copy = [...prev];
                copy[existingIdx] = ticket;
                return copy;
              } else {
                // If not completed, append
                if (ticket.status !== "COMPLETED") {
                  return [...prev, ticket];
                }
                return prev;
              }
            });
          } else {
            // If full ticket not received, refetch via REST
            fetchTicketsRest();
          }
        } catch (err) {
          console.error("Error parsing ticket_updated event:", err);
        }
      });

      es.addEventListener("ping", () => {
        if (!isMountedRef.current) return;
        setLastSyncAt(new Date());
      });

      es.onerror = () => {
        if (!isMountedRef.current) return;
        es.close();
        eventSourceRef.current = null;
        setConnectionStatus("RECONNECTING");

        // Exponential backoff reconnect
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connectSSE();
          }
        }, delay);
      };
    } catch {
      if (!isMountedRef.current) return;
      setConnectionStatus("RECONNECTING");

      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      reconnectTimeoutRef.current = setTimeout(connectSSE, delay);
    }
  }, [branchId, stationId, fetchTicketsRest, onNewTicket]);

  useEffect(() => {
    isMountedRef.current = true;
    connectSSE();

    // Fallback sync interval: Every 12s reconciles state or acts as fallback if SSE is disconnected
    const fallbackPollInterval = setInterval(() => {
      if (isMountedRef.current) {
        fetchTicketsRest();
      }
    }, 12000);

    return () => {
      isMountedRef.current = false;
      clearInterval(fallbackPollInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectSSE, fetchTicketsRest]);

  return {
    tickets,
    setTickets,
    connectionStatus,
    lastSyncAt,
    refetch: fetchTicketsRest,
  };
}
