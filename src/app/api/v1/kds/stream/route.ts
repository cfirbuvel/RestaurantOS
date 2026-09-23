import { NextRequest, NextResponse } from "next/server";
import { realtimeService } from "@/modules/realtime/services/realtime-service";
import { kdsService } from "@/modules/kds/services/kds-service";
import { eventBus, DomainEvent } from "@/core/events/event-bus";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ticketStr = url.searchParams.get("ticket");

  if (!ticketStr) {
    return NextResponse.json(
      { error: "Unauthorized: ephemeral connection ticket required" },
      { status: 401 }
    );
  }

  let validTicket: any;
  try {
    // Single-use token validation (PHASE 00 Section 28)
    validTicket = await realtimeService.validateAndConsumeTicket(ticketStr);
  } catch (err: any) {
    return NextResponse.json({ error: `Unauthorized: ${err.message}` }, { status: 401 });
  }

  const { tenant_id: tenantId, branch_id: branchId, station_id: stationId, channel } = validTicket;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const safeEnqueue = (chunk: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          isClosed = true;
        }
      };

      // 1. Send handshake confirmation
      safeEnqueue(`event: connected\ndata: ${JSON.stringify({ channel, status: "ONLINE" })}\n\n`);

      // 2. Fetch and send initial active tickets for this station (Zero PII)
      try {
        const initialTickets = await kdsService.getTicketsForStation(
          tenantId,
          branchId,
          stationId || null
        );
        safeEnqueue(`event: initial_state\ndata: ${JSON.stringify({ tickets: initialTickets })}\n\n`);
      } catch (err: any) {
        safeEnqueue(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      }

      // 3. Subscribe to live KDS domain events via EventBus
      const unsubs: Array<() => void> = [];

      const handleKDSEvent = async (event: DomainEvent<any>) => {
        if (isClosed) return;
        if (event.tenantId !== tenantId || event.branchId !== branchId) return;

        // If client is bound to a station, filter out other stations
        if (stationId && event.payload?.stationId && event.payload.stationId !== stationId) {
          return;
        }

        try {
          const ticketId = event.payload?.ticketId;
          let ticket = null;
          if (ticketId) {
            ticket = await kdsService.getTicketById(tenantId, ticketId);
          }

          safeEnqueue(
            `event: ticket_updated\ndata: ${JSON.stringify({
              eventType: event.eventType,
              ticketId,
              ticket,
              payload: event.payload,
              timestamp: event.timestamp,
            })}\n\n`
          );
        } catch (err: any) {
          console.error("Error processing KDS live event in stream:", err);
        }
      };

      const kdsEventTypes = [
        "KDSTicketCreated",
        "KDSTicketStarted",
        "KDSTicketReady",
        "KDSTicketBumped",
        "KDSTicketRecalled",
      ];

      for (const eventType of kdsEventTypes) {
        unsubs.push(eventBus.subscribe(eventType, handleKDSEvent));
      }

      // 4. Heartbeat / keepalive timer (every 15s)
      const interval = setInterval(() => {
        safeEnqueue(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
      }, 15000);

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(interval);
        unsubs.forEach((unsub) => {
          try {
            unsub();
          } catch {
            // ignore
          }
        });
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
