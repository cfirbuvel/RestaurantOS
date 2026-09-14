import { NextRequest, NextResponse } from "next/server";
import { realtimeService } from "@/modules/realtime/services/realtime-service";
import { kdsService } from "@/modules/kds/services/kds-service";

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
      // 1. Send handshake confirmation
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ channel, status: "ONLINE" })}\n\n`)
      );

      // 2. Fetch and send initial active tickets for this station (Zero PII)
      try {
        const initialTickets = await kdsService.getTicketsForStation(
          tenantId,
          branchId,
          stationId || null
        );
        controller.enqueue(
          encoder.encode(`event: initial_state\ndata: ${JSON.stringify({ tickets: initialTickets })}\n\n`)
        );
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`)
        );
      }

      // 3. Heartbeat / poll timer (SSE keepalive)
      const interval = setInterval(async () => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`));
        } catch {
          clearInterval(interval);
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
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
