"use client";

import { useEffect, useState, useRef } from "react";
import { KDSTicket, computeKDSSLA, KDSSLAStatus } from "@/modules/kds/domain/kds";

export function useKDSSLAClock(
  rawTickets: KDSTicket[],
  targetPrepMinutes: number = 15,
  onSLAExceeded?: (ticket: KDSTicket) => void
) {
  const [enrichedTickets, setEnrichedTickets] = useState<KDSTicket[]>(rawTickets);
  const previouslyExceededRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function recompute() {
      const now = new Date();
      const nextExceeded = new Set<string>();

      const updated = rawTickets.map((ticket) => {
        // If ticket is completed, freeze timer at completed_at
        const baselineTime = ticket.created_at;
        const endTime = ticket.completed_at ? new Date(ticket.completed_at) : now;
        const sla = computeKDSSLA(baselineTime, targetPrepMinutes, endTime);

        if (sla.slaStatus === "SLA_EXCEEDED") {
          nextExceeded.add(ticket.id);
          // If this ticket was not previously exceeded, notify callback
          if (!previouslyExceededRef.current.has(ticket.id) && !ticket.completed_at) {
            onSLAExceeded?.(ticket);
          }
        }

        return {
          ...ticket,
          sla_status: sla.slaStatus as KDSSLAStatus,
          elapsed_seconds: sla.elapsedSeconds,
          remaining_seconds: sla.remainingSeconds,
          formatted_timer: sla.formattedTimer,
        };
      });

      previouslyExceededRef.current = nextExceeded;
      setEnrichedTickets(updated);
    }

    recompute();
    const timer = setInterval(recompute, 1000);
    return () => clearInterval(timer);
  }, [rawTickets, targetPrepMinutes, onSLAExceeded]);

  return enrichedTickets;
}
