"use client";

import React, { useEffect, useState } from "react";
import { KDSTicket } from "@/modules/kds/domain/kds";
import { RotateCcw, X, Clock, CheckCircle } from "lucide-react";

interface KDSRecallModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  stationId?: string | null;
  onRecall: (ticketId: string) => Promise<void>;
}

export const KDSRecallModal: React.FC<KDSRecallModalProps> = ({
  isOpen,
  onClose,
  branchId,
  stationId,
  onRecall,
}) => {
  const [completedTickets, setCompletedTickets] = useState<KDSTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [recallingId, setRecallingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadCompleted() {
      setLoading(true);
      try {
        let url = `/api/v1/kds/tickets?branchId=${encodeURIComponent(branchId)}&status=COMPLETED`;
        if (stationId) {
          url += `&stationId=${encodeURIComponent(stationId)}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tickets)) {
            // Sort by most recently completed first
            const sorted = data.tickets.sort((a: KDSTicket, b: KDSTicket) => {
              const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
              const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
              return bTime - aTime;
            });
            setCompletedTickets(sorted);
          }
        }
      } catch (err) {
        console.error("Error loading completed tickets:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCompleted();
  }, [isOpen, branchId, stationId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2 text-slate-100">
            <RotateCcw className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-black">שחזור כרטיסים שנסגרו (Recall Bumped)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold">טוען כרטיסים שהושלמו...</span>
            </div>
          ) : completedTickets.length === 0 ? (
            <div className="py-12 text-center text-slate-500 italic text-sm">
              לא נמצאו כרטיסים שנסגרו לאחרונה
            </div>
          ) : (
            completedTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4 hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-slate-100 tabular-nums">
                      #{ticket.order_number}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      הושלם
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      נסגר: {ticket.completed_at ? new Date(ticket.completed_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                    <span>
                      {ticket.items?.length || 0} פריטים
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={recallingId === ticket.id}
                  onClick={async () => {
                    setRecallingId(ticket.id);
                    await onRecall(ticket.id);
                    setCompletedTickets((prev) => prev.filter((t) => t.id !== ticket.id));
                    setRecallingId(null);
                    onClose();
                  }}
                  className="touch-target-pos px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {recallingId === ticket.id ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>החזר לפס (Recall)</span>
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
