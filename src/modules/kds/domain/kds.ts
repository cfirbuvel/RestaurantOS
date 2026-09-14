import { z } from "zod";

export type KDSStationType = "KITCHEN" | "EXPO" | "DRIVE_THRU";

export type KDSTicketStatus =
  | "QUEUED"
  | "STARTED"
  | "READY"
  | "COMPLETED"
  | "RECALLED";

export type KDSTicketPriority = "LOW" | "NORMAL" | "VIP" | "RUSH";

export type KDSSLAStatus = "NORMAL" | "NEAR_SLA" | "SLA_EXCEEDED";

export interface KDSStation {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  display_name: string;
  station_type: KDSStationType;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface KDSTicketItem {
  id: string;
  tenant_id: string;
  ticket_id: string;
  order_item_id: string;
  product_id: string;
  name: string;
  quantity: number;
  notes?: string | null;
  selected_modifiers: Array<{ modifier_id: string; name: string; price: number }>;
  status: "PENDING" | "PREPARING" | "READY";
  created_at: Date | string;
  updated_at: Date | string;
}

export interface KDSTicket {
  id: string;
  tenant_id: string;
  branch_id: string;
  station_id: string;
  order_id: string;
  order_number: string;
  status: KDSTicketStatus;
  priority: KDSTicketPriority;
  started_at?: Date | string | null;
  ready_at?: Date | string | null;
  completed_at?: Date | string | null;
  recalled_at?: Date | string | null;
  cook_id?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  items?: KDSTicketItem[];
  // SLA enriched fields (computed dynamically)
  sla_status?: KDSSLAStatus;
  elapsed_seconds?: number;
  remaining_seconds?: number;
  formatted_timer?: string;
}

export interface ProductStationAssignment {
  id: string;
  tenant_id: string;
  branch_id: string;
  station_id: string;
  product_id?: string | null;
  category_id?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Valid transitions for KDS ticket lifecycle
 * Strictly describes food preparation: QUEUED -> STARTED -> READY -> COMPLETED
 * Fallback: COMPLETED -> RECALLED -> (STARTED or READY)
 */
export const VALID_KDS_TRANSITIONS: Record<KDSTicketStatus, KDSTicketStatus[]> = {
  QUEUED: ["STARTED"],
  STARTED: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: ["RECALLED"],
  RECALLED: ["STARTED", "READY"],
};

export function canTransitionKDSTicket(
  current: KDSTicketStatus,
  target: KDSTicketStatus
): boolean {
  return VALID_KDS_TRANSITIONS[current]?.includes(target) ?? false;
}

/**
 * SLA computation helper (PHASE 00 Section 27)
 * - NORMAL: 0% to 75% of target SLA
 * - NEAR_SLA: 75% to 100% of target SLA
 * - SLA_EXCEEDED: > 100% of target SLA (displays e.g. "+00:37")
 */
export function computeKDSSLA(
  queuedAt: Date | string,
  targetPrepMinutes: number = 15,
  now: Date = new Date()
): {
  slaStatus: KDSSLAStatus;
  elapsedSeconds: number;
  remainingSeconds: number;
  isExceeded: boolean;
  formattedTimer: string;
} {
  const queuedTime = new Date(queuedAt).getTime();
  const currentTime = now.getTime();
  const elapsedSeconds = Math.max(0, Math.floor((currentTime - queuedTime) / 1000));
  const targetSeconds = targetPrepMinutes * 60;
  const remainingSeconds = targetSeconds - elapsedSeconds;

  let slaStatus: KDSSLAStatus = "NORMAL";
  let formattedTimer: string;

  if (elapsedSeconds > targetSeconds) {
    slaStatus = "SLA_EXCEEDED";
    const overtimeSeconds = elapsedSeconds - targetSeconds;
    const mins = Math.floor(overtimeSeconds / 60);
    const secs = overtimeSeconds % 60;
    formattedTimer = `+${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  } else if (elapsedSeconds >= targetSeconds * 0.75) {
    slaStatus = "NEAR_SLA";
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    formattedTimer = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  } else {
    slaStatus = "NORMAL";
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    formattedTimer = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return {
    slaStatus,
    elapsedSeconds,
    remainingSeconds,
    isExceeded: slaStatus === "SLA_EXCEEDED",
    formattedTimer,
  };
}

// Zod validation schemas
export const createStationSchema = z.object({
  name: z.string().min(1, "Station name is required").max(100),
  displayName: z.string().min(1, "Display name is required").max(150),
  stationType: z.enum(["KITCHEN", "EXPO", "DRIVE_THRU"]).default("KITCHEN"),
  isActive: z.boolean().default(true),
});

export const updateStationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(150).optional(),
  stationType: z.enum(["KITCHEN", "EXPO", "DRIVE_THRU"]).optional(),
  isActive: z.boolean().optional(),
});

export const assignProductStationSchema = z.object({
  stationId: z.string().min(1, "Station ID is required"),
  productId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
});
