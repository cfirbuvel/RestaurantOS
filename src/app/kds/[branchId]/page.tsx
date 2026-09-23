"use client";

import React, { use, useEffect, useState, useMemo, useCallback } from "react";
import { KDSStation, KDSTicket } from "@/modules/kds/domain/kds";
import { useKDSStream } from "@/components/kds/hooks/use-kds-stream";
import { useKDSSLAClock } from "@/components/kds/hooks/use-kds-sla-clock";
import { useKDSActions } from "@/components/kds/hooks/use-kds-actions";
import { useKDSAudio } from "@/components/kds/hooks/use-kds-audio";
import { KDSStatusBar } from "@/components/kds/KDSStatusBar";
import { KDSTicketRail } from "@/components/kds/KDSTicketRail";
import { KDSOfflineBanner } from "@/components/kds/KDSOfflineBanner";
import { KDSRecallModal } from "@/components/kds/KDSRecallModal";
import { KDSKeyboardHandler } from "@/components/kds/KDSKeyboardHandler";
import { KDSAuthGuard } from "@/components/kds/KDSAuthGuard";
import { AlertCircle, X } from "lucide-react";

interface KDSPageProps {
  params: Promise<{ branchId: string }>;
}

export default function KDSBranchPage({ params }: KDSPageProps) {
  const { branchId } = use(params);

  return (
    <KDSAuthGuard branchId={branchId}>
      <KDSMainDisplay branchId={branchId} />
    </KDSAuthGuard>
  );
}

function KDSMainDisplay({ branchId }: { branchId: string }) {
  const [stations, setStations] = useState<KDSStation[]>([]);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [focusedTicketId, setFocusedTicketId] = useState<string | null>(null);
  const [isRecallModalOpen, setIsRecallModalOpen] = useState<boolean>(false);

  // Audio chimes
  const { isMuted, toggleMute, playNewTicketChime, playOverdueAlert } = useKDSAudio();

  // Load stations for this branch
  useEffect(() => {
    async function loadStations() {
      try {
        const res = await fetch(`/api/v1/kds/stations?branchId=${encodeURIComponent(branchId)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.stations)) {
            setStations(data.stations);
          }
        }
      } catch (err) {
        console.error("Failed to load KDS stations:", err);
      }
    }
    loadStations();
  }, [branchId]);

  // Realtime SSE stream
  const handleNewTicket = useCallback(
    (_ticket: KDSTicket) => {
      playNewTicketChime();
    },
    [playNewTicketChime]
  );

  const {
    tickets,
    setTickets,
    connectionStatus,
    lastSyncAt,
    refetch,
  } = useKDSStream({
    branchId,
    stationId: activeStationId,
    onNewTicket: handleNewTicket,
  });

  // Live ticking SLA clock
  const enrichedTickets = useKDSSLAClock(tickets, 15, () => {
    playOverdueAlert();
  });

  // Actions (start / ready / bump / recall)
  const {
    startTicket,
    readyTicket,
    bumpTicket,
    recallTicket,
    recallLastBumped,
    lastBumpedTicket,
    pendingIds,
    errorMessage,
    clearError,
  } = useKDSActions({ setTickets });

  // Counts by stage
  const counts = useMemo(() => {
    let queued = 0;
    let started = 0;
    let ready = 0;

    for (const t of enrichedTickets) {
      if (t.status === "QUEUED") queued++;
      else if (t.status === "STARTED" || t.status === "RECALLED") started++;
      else if (t.status === "READY") ready++;
    }

    return { queued, started, ready };
  }, [enrichedTickets]);

  const isOffline = connectionStatus === "OFFLINE";

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* ── Global Keyboard Shortcut Interceptor ─────────────────── */}
      <KDSKeyboardHandler
        tickets={enrichedTickets}
        focusedTicketId={focusedTicketId}
        setFocusedTicketId={setFocusedTicketId}
        onStart={startTicket}
        onReady={readyTicket}
        onBump={bumpTicket}
        onRecallLast={recallLastBumped}
      />

      {/* ── Status Bar ───────────────────────────────────────────── */}
      <KDSStatusBar
        branchId={branchId}
        stations={stations}
        activeStationId={activeStationId}
        onSelectStation={setActiveStationId}
        connectionStatus={connectionStatus}
        lastSyncAt={lastSyncAt}
        counts={counts}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onOpenRecallModal={() => setIsRecallModalOpen(true)}
        hasLastBumped={!!lastBumpedTicket}
        onRecallLastBumped={recallLastBumped}
      />

      {/* ── Offline Banner ───────────────────────────────────────── */}
      <KDSOfflineBanner status={connectionStatus} onRetry={refetch} />

      {/* ── Error Toast ──────────────────────────────────────────── */}
      {errorMessage && (
        <div className="bg-red-900/90 border border-red-500 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-lg mx-4 mt-2 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={clearError}
            className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Main Digital Ticket Rail ─────────────────────────────── */}
      <KDSTicketRail
        tickets={enrichedTickets}
        focusedTicketId={focusedTicketId}
        pendingIds={pendingIds}
        disabled={isOffline}
        onSelectTicket={(id) => setFocusedTicketId(id)}
        onStart={startTicket}
        onReady={readyTicket}
        onBump={bumpTicket}
      />

      {/* ── Recall Bumped Tickets Modal ──────────────────────────── */}
      <KDSRecallModal
        isOpen={isRecallModalOpen}
        onClose={() => setIsRecallModalOpen(false)}
        branchId={branchId}
        stationId={activeStationId}
        onRecall={recallTicket}
      />
    </div>
  );
}
