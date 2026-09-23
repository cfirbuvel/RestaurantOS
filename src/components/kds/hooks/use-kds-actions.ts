"use client";

import { useState, useCallback, Dispatch, SetStateAction } from "react";
import { KDSTicket, KDSTicketStatus } from "@/modules/kds/domain/kds";

interface UseKDSActionsOptions {
  setTickets: Dispatch<SetStateAction<KDSTicket[]>>;
}

export function useKDSActions({ setTickets }: UseKDSActionsOptions) {
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [lastBumpedTicket, setLastBumpedTicket] = useState<KDSTicket | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setPending = (id: string, isPending: boolean) => {
    setPendingIds((prev) => ({ ...prev, [id]: isPending }));
  };

  const startTicket = useCallback(
    async (ticketId: string) => {
      setPending(ticketId, true);
      setErrorMessage(null);

      // Snapshot for rollback
      let previousTicket: KDSTicket | undefined;
      setTickets((prev) => {
        previousTicket = prev.find((t) => t.id === ticketId);
        return prev.map((t) => (t.id === ticketId ? { ...t, status: "STARTED" as KDSTicketStatus } : t));
      });

      try {
        const res = await fetch(`/api/v1/kds/tickets/${encodeURIComponent(ticketId)}/start`, {
          method: "POST",
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to start ticket");
        }

        const data = await res.json();
        if (data.ticket) {
          setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)));
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to start ticket");
        // Rollback
        if (previousTicket) {
          const pt = previousTicket;
          setTickets((prev) => prev.map((t) => (t.id === ticketId ? pt : t)));
        }
      } finally {
        setPending(ticketId, false);
      }
    },
    [setTickets]
  );

  const readyTicket = useCallback(
    async (ticketId: string) => {
      setPending(ticketId, true);
      setErrorMessage(null);

      let previousTicket: KDSTicket | undefined;
      setTickets((prev) => {
        previousTicket = prev.find((t) => t.id === ticketId);
        return prev.map((t) => (t.id === ticketId ? { ...t, status: "READY" as KDSTicketStatus } : t));
      });

      try {
        const res = await fetch(`/api/v1/kds/tickets/${encodeURIComponent(ticketId)}/ready`, {
          method: "POST",
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to mark ticket ready");
        }

        const data = await res.json();
        if (data.ticket) {
          setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)));
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to ready ticket");
        if (previousTicket) {
          const pt = previousTicket;
          setTickets((prev) => prev.map((t) => (t.id === ticketId ? pt : t)));
        }
      } finally {
        setPending(ticketId, false);
      }
    },
    [setTickets]
  );

  const bumpTicket = useCallback(
    async (ticketId: string) => {
      setPending(ticketId, true);
      setErrorMessage(null);

      let targetTicket: KDSTicket | undefined;
      setTickets((prev) => {
        targetTicket = prev.find((t) => t.id === ticketId);
        // Optimistically remove from active list
        return prev.filter((t) => t.id !== ticketId);
      });

      if (targetTicket) {
        setLastBumpedTicket(targetTicket);
      }

      try {
        const res = await fetch(`/api/v1/kds/tickets/${encodeURIComponent(ticketId)}/bump`, {
          method: "POST",
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to bump ticket");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to bump ticket");
        // Rollback
        if (targetTicket) {
          const tt = targetTicket;
          setTickets((prev) => [...prev, tt]);
        }
      } finally {
        setPending(ticketId, false);
      }
    },
    [setTickets]
  );

  const recallTicket = useCallback(
    async (ticketId: string) => {
      setPending(ticketId, true);
      setErrorMessage(null);

      try {
        const res = await fetch(`/api/v1/kds/tickets/${encodeURIComponent(ticketId)}/recall`, {
          method: "POST",
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to recall ticket");
        }

        const data = await res.json();
        if (data.ticket) {
          setTickets((prev) => {
            const exists = prev.some((t) => t.id === data.ticket.id);
            if (exists) {
              return prev.map((t) => (t.id === data.ticket.id ? data.ticket : t));
            }
            return [data.ticket, ...prev];
          });
        }

        if (lastBumpedTicket?.id === ticketId) {
          setLastBumpedTicket(null);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to recall ticket");
      } finally {
        setPending(ticketId, false);
      }
    },
    [setTickets, lastBumpedTicket]
  );

  const recallLastBumped = useCallback(async () => {
    if (!lastBumpedTicket) return;
    await recallTicket(lastBumpedTicket.id);
  }, [lastBumpedTicket, recallTicket]);

  return {
    startTicket,
    readyTicket,
    bumpTicket,
    recallTicket,
    recallLastBumped,
    lastBumpedTicket,
    pendingIds,
    errorMessage,
    clearError: () => setErrorMessage(null),
  };
}
