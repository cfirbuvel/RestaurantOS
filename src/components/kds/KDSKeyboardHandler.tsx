"use client";

import { useEffect } from "react";
import { KDSTicket } from "@/modules/kds/domain/kds";

interface KDSKeyboardHandlerProps {
  tickets: KDSTicket[];
  focusedTicketId: string | null;
  setFocusedTicketId: (id: string | null) => void;
  onStart: (id: string) => void;
  onReady: (id: string) => void;
  onBump: (id: string) => void;
  onRecallLast: () => void;
}

export function KDSKeyboardHandler({
  tickets,
  focusedTicketId,
  setFocusedTicketId,
  onStart,
  onReady,
  onBump,
  onRecallLast,
}: KDSKeyboardHandlerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      // F1: Start action
      if (e.key === "F1") {
        e.preventDefault();
        if (focusedTicketId) {
          const focused = tickets.find((t) => t.id === focusedTicketId);
          if (focused?.status === "QUEUED") {
            onStart(focused.id);
            return;
          }
        }
        // Fallback: start first queued ticket
        const firstQueued = tickets.find((t) => t.status === "QUEUED");
        if (firstQueued) {
          onStart(firstQueued.id);
        }
        return;
      }

      // F2: Ready action
      if (e.key === "F2") {
        e.preventDefault();
        if (focusedTicketId) {
          const focused = tickets.find((t) => t.id === focusedTicketId);
          if (focused?.status === "STARTED" || focused?.status === "RECALLED") {
            onReady(focused.id);
            return;
          }
        }
        // Fallback: ready first started ticket
        const firstStarted = tickets.find((t) => t.status === "STARTED" || t.status === "RECALLED");
        if (firstStarted) {
          onReady(firstStarted.id);
        }
        return;
      }

      // F3: Bump action
      if (e.key === "F3") {
        e.preventDefault();
        if (focusedTicketId) {
          const focused = tickets.find((t) => t.id === focusedTicketId);
          if (focused?.status === "READY") {
            onBump(focused.id);
            return;
          }
        }
        // Fallback: bump first ready ticket
        const firstReady = tickets.find((t) => t.status === "READY");
        if (firstReady) {
          onBump(firstReady.id);
        }
        return;
      }

      // F4: Recall last bumped
      if (e.key === "F4") {
        e.preventDefault();
        onRecallLast();
        return;
      }

      // Escape: Deselect focused ticket
      if (e.key === "Escape") {
        setFocusedTicketId(null);
        return;
      }

      // Enter / Space: Primary action on focused ticket
      if (e.key === "Enter" || e.key === " ") {
        if (focusedTicketId) {
          const focused = tickets.find((t) => t.id === focusedTicketId);
          if (focused) {
            e.preventDefault();
            if (focused.status === "QUEUED") onStart(focused.id);
            else if (focused.status === "STARTED" || focused.status === "RECALLED") onReady(focused.id);
            else if (focused.status === "READY") onBump(focused.id);
          }
        }
        return;
      }

      // Arrow navigation
      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (tickets.length === 0) return;
        e.preventDefault();

        const currentIdx = tickets.findIndex((t) => t.id === focusedTicketId);
        let nextIdx = 0;

        if (currentIdx === -1) {
          nextIdx = 0;
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          nextIdx = (currentIdx + 1) % tickets.length;
        } else {
          nextIdx = (currentIdx - 1 + tickets.length) % tickets.length;
        }

        setFocusedTicketId(tickets[nextIdx].id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tickets, focusedTicketId, setFocusedTicketId, onStart, onReady, onBump, onRecallLast]);

  return null;
}
