"use client";

import React from "react";
import { KDSTicket } from "@/modules/kds/domain/kds";
import { KDSTicketCard } from "./KDSTicketCard";
import { Clock, Flame, CheckCircle } from "lucide-react";

interface KDSTicketRailProps {
  tickets: KDSTicket[];
  focusedTicketId: string | null;
  pendingIds: Record<string, boolean>;
  disabled?: boolean;
  onSelectTicket: (id: string) => void;
  onStart: (id: string) => void;
  onReady: (id: string) => void;
  onBump: (id: string) => void;
}

export const KDSTicketRail: React.FC<KDSTicketRailProps> = ({
  tickets,
  focusedTicketId,
  pendingIds,
  disabled = false,
  onSelectTicket,
  onStart,
  onReady,
  onBump,
}) => {
  const queuedTickets = tickets.filter((t) => t.status === "QUEUED");
  const startedTickets = tickets.filter((t) => t.status === "STARTED" || t.status === "RECALLED");
  const readyTickets = tickets.filter((t) => t.status === "READY");

  return (
    <div className="flex-1 p-4 overflow-x-auto overflow-y-hidden select-none bg-slate-950">
      {/* 3 Columns Rail */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-[calc(100vh-130px)] min-w-[320px] 2xl:gap-6">
        {/* ── Column 1: NEW / QUEUED ─────────────────────────────────── */}
        <section className="flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
          {/* Header */}
          <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <h2 className="text-sm font-black text-slate-100 tracking-wide">
                חדש / ממתין [NEW]
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-black tabular-nums">
              {queuedTickets.length}
            </span>
          </div>

          {/* Cards container */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3.5 divide-y divide-transparent">
            {queuedTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 py-12">
                <Clock className="w-8 h-8 opacity-40" />
                <span className="text-xs font-bold">אין כרטיסים ממתינים</span>
              </div>
            ) : (
              queuedTickets.map((ticket) => (
                <KDSTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isFocused={focusedTicketId === ticket.id}
                  isPending={!!pendingIds[ticket.id]}
                  disabled={disabled}
                  onSelect={() => onSelectTicket(ticket.id)}
                  onStart={onStart}
                  onReady={onReady}
                  onBump={onBump}
                />
              ))
            )}
          </div>
        </section>

        {/* ── Column 2: PREPARING / STARTED ──────────────────────────── */}
        <section className="flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
          {/* Header */}
          <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-black text-slate-100 tracking-wide">
                בהכנה בפס [PREPARING]
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black tabular-nums">
              {startedTickets.length}
            </span>
          </div>

          {/* Cards container */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3.5">
            {startedTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 py-12">
                <Flame className="w-8 h-8 opacity-40" />
                <span className="text-xs font-bold">אין מנות בהכנה כרגע</span>
              </div>
            ) : (
              startedTickets.map((ticket) => (
                <KDSTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isFocused={focusedTicketId === ticket.id}
                  isPending={!!pendingIds[ticket.id]}
                  disabled={disabled}
                  onSelect={() => onSelectTicket(ticket.id)}
                  onStart={onStart}
                  onReady={onReady}
                  onBump={onBump}
                />
              ))
            )}
          </div>
        </section>

        {/* ── Column 3: READY ────────────────────────────────────────── */}
        <section className="flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl md:col-span-2 lg:col-span-1">
          {/* Header */}
          <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-black text-slate-100 tracking-wide">
                מוכן לחלוקה [READY]
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black tabular-nums">
              {readyTickets.length}
            </span>
          </div>

          {/* Cards container */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3.5">
            {readyTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 py-12">
                <CheckCircle className="w-8 h-8 opacity-40" />
                <span className="text-xs font-bold">אין כרטיסים מוכנים להגשה</span>
              </div>
            ) : (
              readyTickets.map((ticket) => (
                <KDSTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isFocused={focusedTicketId === ticket.id}
                  isPending={!!pendingIds[ticket.id]}
                  disabled={disabled}
                  onSelect={() => onSelectTicket(ticket.id)}
                  onStart={onStart}
                  onReady={onReady}
                  onBump={onBump}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
