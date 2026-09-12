import React from "react";
import {
  Sparkles,
  Check,
  Flame,
  BellRing,
  Bike,
  CheckCircle2,
  AlertOctagon,
  LucideIcon,
} from "lucide-react";

export type OrderStatus =
  | "NEW"
  | "APPROVED"
  | "IN_PREPARATION"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

interface StatusConfig {
  label: string;
  bg: string;
  border: string;
  text: string;
  icon: LucideIcon;
}

const STATUS_CONFIGS: Record<OrderStatus, StatusConfig> = {
  NEW: {
    label: "חדשה",
    bg: "bg-[#EFF6FF]",
    border: "border-[#3B82F6]",
    text: "text-[#1D4ED8]",
    icon: Sparkles,
  },
  APPROVED: {
    label: "אושרה",
    bg: "bg-[#EEF2FF]",
    border: "border-[#6366F1]",
    text: "text-[#4338CA]",
    icon: Check,
  },
  IN_PREPARATION: {
    label: "בהכנה",
    bg: "bg-[#FFFBEB]",
    border: "border-[#F59E0B]",
    text: "text-[#B45309]",
    icon: Flame,
  },
  READY: {
    label: "מוכנה",
    bg: "bg-[#ECFDF5]",
    border: "border-[#10B981]",
    text: "text-[#047857]",
    icon: BellRing,
  },
  OUT_FOR_DELIVERY: {
    label: "במשלוח",
    bg: "bg-[#F0F9FF]",
    border: "border-[#0284C7]",
    text: "text-[#0369A1]",
    icon: Bike,
  },
  DELIVERED: {
    label: "נמסרה",
    bg: "bg-[#F1F5F9]",
    border: "border-[#94A3B8]",
    text: "text-[#334155]",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "בוטלה",
    bg: "bg-[#FEF2F2]",
    border: "border-[#EF4444]",
    text: "text-[#B91C1C]",
    icon: AlertOctagon,
  },
};

export interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
  id?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = "", id }) => {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.NEW;
  const Icon = config.icon;

  return (
    <div
      id={id || `status-badge-${status.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold leading-none select-none ${config.bg} ${config.border} ${config.text} ${className}`}
      dir="rtl"
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </div>
  );
};
