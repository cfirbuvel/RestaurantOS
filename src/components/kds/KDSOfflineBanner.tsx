"use client";

import React from "react";
import { ConnectionStatus } from "./hooks/use-kds-stream";
import { WifiOff, RefreshCw } from "lucide-react";

interface KDSOfflineBannerProps {
  status: ConnectionStatus;
  onRetry: () => void;
}

export const KDSOfflineBanner: React.FC<KDSOfflineBannerProps> = ({ status, onRetry }) => {
  if (status === "ONLINE") return null;

  return (
    <div className="bg-red-600/90 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md border-b border-red-500 animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 animate-pulse" />
        <span>
          {status === "RECONNECTING"
            ? "אבד החיבור לשרת בזמן אמת. המערכת מנסה להתחבר מחדש באופן אוטומטי... (כרטיסים קיימים נשמרים במסך)"
            : status === "OFFLINE"
            ? "המערכת במצב לא מקוון (Offline). פעולות סגירה מושבתות זמנית למניעת אי-התאמה."
            : "מתחבר לשרת KDS..."}
        </span>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white font-black flex items-center gap-1 transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>נסה עכשיו</span>
      </button>
    </div>
  );
};
