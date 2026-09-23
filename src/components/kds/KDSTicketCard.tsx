"use client";

import React from "react";
import { KDSTicket } from "@/modules/kds/domain/kds";
import { AlertTriangle, Clock, Play, CheckCircle2, Check, Flame } from "lucide-react";

interface KDSTicketCardProps {
  ticket: KDSTicket;
  isFocused?: boolean;
  isPending?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onStart: (id: string) => void;
  onReady: (id: string) => void;
  onBump: (id: string) => void;
}

export const KDSTicketCard: React.FC<KDSTicketCardProps> = ({
  ticket,
  isFocused = false,
  isPending = false,
  disabled = false,
  onSelect,
  onStart,
  onReady,
  onBump,
}) => {
  const isOverdue = ticket.sla_status === "SLA_EXCEEDED";
  const isNearSla = ticket.sla_status === "NEAR_SLA";
  const isRush = ticket.priority === "RUSH" || ticket.priority === "VIP";

  // Determine header styling based on SLA state
  let headerBgClass = "bg-slate-800 text-slate-100 border-b border-slate-700";
  let timerBadgeClass = "bg-slate-700/80 text-emerald-400 border border-slate-600";

  if (isOverdue) {
    headerBgClass = "bg-red-600 text-white font-black animate-[pulse_2s_ease-in-out_infinite]";
    timerBadgeClass = "bg-white text-red-700 font-extrabold shadow-sm";
  } else if (isNearSla) {
    headerBgClass = "bg-amber-500 text-slate-950 font-bold border-b border-amber-600";
    timerBadgeClass = "bg-amber-950/80 text-amber-200 border border-amber-800";
  }

  return (
    <div
      onClick={onSelect}
      tabIndex={0}
      aria-label={`Ticket ${ticket.order_number}, Status: ${ticket.status}, SLA: ${ticket.sla_status || "NORMAL"}`}
      className={`rounded-2xl border flex flex-col justify-between overflow-hidden transition-all duration-150 select-none ${
        isFocused
          ? "ring-4 ring-blue-500 ring-offset-2 ring-offset-slate-950 scale-[1.01]"
          : "hover:border-slate-600"
      } ${
        isOverdue
          ? "border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.25)] bg-slate-900"
          : isNearSla
          ? "border-amber-500/80 bg-slate-900"
          : "border-slate-800 bg-slate-900 shadow-lg"
      }`}
    >
      {/* ── Header: Order Number, Station, & SLA Timer ──────────────── */}
      <div className={`p-4 flex items-center justify-between ${headerBgClass}`}>
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight tabular-nums">
                #{ticket.order_number}
              </span>
              {isRush && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 flex items-center gap-0.5">
                  <Flame className="w-3 h-3 fill-slate-950" />
                  {ticket.priority}
                </span>
              )}
            </div>
            {ticket.cook_id && (
              <span className="text-[11px] opacity-80 block truncate">
                טבח: {ticket.cook_id}
              </span>
            )}
          </div>
        </div>

        {/* Live SLA Overdue or Remaining Timer */}
        <div className="flex flex-col items-end">
          <div
            className={`px-3 py-1 rounded-xl text-base font-mono font-black tabular-nums flex items-center gap-1.5 ${timerBadgeClass}`}
          >
            {isOverdue ? (
              <>
                <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />
                <span className="tracking-wide">
                  {ticket.formatted_timer || "+00:00"}
                </span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 opacity-75" />
                <span>{ticket.formatted_timer || "15:00"}</span>
              </>
            )}
          </div>
          {isOverdue && (
            <span className="text-[10px] tracking-wider uppercase font-black text-white/95 mt-0.5">
              חריגת SLA
            </span>
          )}
        </div>
      </div>

      {/* ── Body: Items List & Modifiers ──────────────────────────── */}
      <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[380px] bg-slate-900 text-slate-200 divide-y divide-slate-800/60">
        {(!ticket.items || ticket.items.length === 0) ? (
          <div className="text-xs text-slate-500 italic py-2 text-center">
            אין פריטים רשומים לכרטיס זה
          </div>
        ) : (
          ticket.items.map((item, idx) => (
            <div key={item.id || idx} className="pt-2 first:pt-0">
              <div className="flex items-start gap-2.5">
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-lg bg-slate-800 text-emerald-400 font-extrabold text-sm border border-slate-700 tabular-nums">
                  {item.quantity}×
                </span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-100 leading-snug">
                    {item.name}
                  </div>

                  {/* Modifiers */}
                  {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                    <div className="mt-1 space-y-0.5 pr-2">
                      {item.selected_modifiers.map((mod, mIdx) => (
                        <div
                          key={mIdx}
                          className="text-xs text-slate-400 flex items-center gap-1.5 font-medium"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          <span>{mod.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Special Kitchen Cook Notes */}
                  {item.notes && (
                    <div className="mt-1.5 p-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold leading-relaxed flex items-start gap-1">
                      <span className="opacity-75">📝</span>
                      <span>{item.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Footer: Status & Minimum 64px Touch Target Action Button ── */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-400">
          {ticket.status === "QUEUED" && (
            <span className="text-blue-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              ממתין להכנה
            </span>
          )}
          {ticket.status === "STARTED" && (
            <span className="text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              בהכנה בפס
            </span>
          )}
          {ticket.status === "READY" && (
            <span className="text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              מוכן לחלוקה
            </span>
          )}
          {ticket.status === "RECALLED" && (
            <span className="text-purple-400 flex items-center gap-1">
              שוחזר להכנה
            </span>
          )}
        </div>

        {/* Action Button: min-height 64px, large typography, high touch response */}
        {ticket.status === "QUEUED" && (
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={(e) => {
              e.stopPropagation();
              onStart(ticket.id);
            }}
            className="touch-target-kds flex-1 max-w-[180px] px-4 py-3 rounded-xl font-black text-sm tracking-wide bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isPending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>התחל [F1]</span>
              </>
            )}
          </button>
        )}

        {(ticket.status === "STARTED" || ticket.status === "RECALLED") && (
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={(e) => {
              e.stopPropagation();
              onReady(ticket.id);
            }}
            className="touch-target-kds flex-1 max-w-[180px] px-4 py-3 rounded-xl font-black text-sm tracking-wide bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isPending ? (
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>סמן מוכן [F2]</span>
              </>
            )}
          </button>
        )}

        {ticket.status === "READY" && (
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={(e) => {
              e.stopPropagation();
              onBump(ticket.id);
            }}
            className="touch-target-kds flex-1 max-w-[180px] px-4 py-3 rounded-xl font-black text-sm tracking-wide bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isPending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5 stroke-[3]" />
                <span>סיים והסר [F3]</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
