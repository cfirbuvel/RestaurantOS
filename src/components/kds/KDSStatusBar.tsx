"use client";

import React from "react";
import { ConnectionStatus } from "./hooks/use-kds-stream";
import { KDSStation } from "@/modules/kds/domain/kds";
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Maximize2,
  Minimize2,
  Radio,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";

interface KDSStatusBarProps {
  branchId: string;
  branchName?: string;
  stations: KDSStation[];
  activeStationId?: string | null;
  onSelectStation: (stationId: string | null) => void;
  connectionStatus: ConnectionStatus;
  lastSyncAt: Date | null;
  counts: { queued: number; started: number; ready: number };
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenRecallModal: () => void;
  hasLastBumped: boolean;
  onRecallLastBumped: () => void;
}

export const KDSStatusBar: React.FC<KDSStatusBarProps> = ({
  branchId: _branchId,
  branchName = "מסעדה ראשית",
  stations,
  activeStationId,
  onSelectStation,
  connectionStatus,
  lastSyncAt,
  counts,
  isMuted,
  onToggleMute,
  onOpenRecallModal,
  hasLastBumped,
  onRecallLastBumped,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header className="bg-slate-950 border-b border-slate-800 text-slate-100 px-4 py-3 select-none flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 shadow-xl">
      {/* ── Left: Branding & Station Switcher ────────────────────────── */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              KDS
            </span>
            <h1 className="text-base font-black text-slate-100 truncate max-w-[200px]">
              {branchName}
            </h1>
          </div>
        </div>

        {/* Stations Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => onSelectStation(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !activeStationId
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            כל העמדות (EXPO)
          </button>
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectStation(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeStationId === s.id
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s.display_name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Center: Ticket Counts by Column ─────────────────────────── */}
      <div className="flex items-center gap-2 font-mono text-xs">
        <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span>ממתין:</span>
          <span className="text-sm font-black tabular-nums">{counts.queued}</span>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>בהכנה:</span>
          <span className="text-sm font-black tabular-nums">{counts.started}</span>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>מוכן:</span>
          <span className="text-sm font-black tabular-nums">{counts.ready}</span>
        </div>
      </div>

      {/* ── Right: Connection Pill, Audio, Recall, Fullscreen ──────── */}
      <div className="flex items-center gap-2">
        {/* Connection Status Pill */}
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 border ${
            connectionStatus === "ONLINE"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : connectionStatus === "CONNECTING"
              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
              : connectionStatus === "RECONNECTING"
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
              : "bg-red-500/10 text-red-400 border-red-500/30 animate-pulse"
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>
            {connectionStatus === "ONLINE"
              ? "מחובר בזמן אמת"
              : connectionStatus === "CONNECTING"
              ? "מתחבר..."
              : connectionStatus === "RECONNECTING"
              ? "מתחבר מחדש..."
              : "מנותק"}
          </span>
        </div>

        {/* Last Sync */}
        {lastSyncAt && (
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-500 font-mono">
            <Clock className="w-3 h-3" />
            <span>
              {lastSyncAt.toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        )}

        {/* Recall Last Shortcut Button */}
        {hasLastBumped && (
          <button
            type="button"
            onClick={onRecallLastBumped}
            title="שחזר כרטיס אחרון שנסגר [F4]"
            className="px-3 py-1.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>שחזר אחרון [F4]</span>
          </button>
        )}

        {/* View All Recalls Drawer Button */}
        <button
          type="button"
          onClick={onOpenRecallModal}
          title="רשימת כרטיסים שנסגרו"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1 text-xs font-bold"
        >
          <Layers className="w-4 h-4 text-purple-400" />
          <span className="hidden sm:inline">היסטוריה</span>
        </button>

        {/* Audio Mute Toggle */}
        <button
          type="button"
          onClick={onToggleMute}
          title={isMuted ? "בטל השתקת צליל" : "השתק צלילי מטבח"}
          className={`p-2 rounded-xl border transition-all ${
            isMuted
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title="מסך מלא"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
