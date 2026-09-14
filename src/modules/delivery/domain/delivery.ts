import { z } from "zod";

// ============================================================================
// Phase 4: Delivery, Driver & Fleet Enums
// ============================================================================

export type DeliveryStatus =
  | "WAITING"
  | "PREPARING"
  | "READY"
  | "AVAILABLE_FOR_ASSIGNMENT"
  | "ASSIGNED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "ARRIVED_AT_CUSTOMER_AREA"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  "WAITING",
  "PREPARING",
  "READY",
  "AVAILABLE_FOR_ASSIGNMENT",
  "ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "ARRIVED_AT_CUSTOMER_AREA",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
];

export type ShiftStatus = "OFF_SHIFT" | "ON_SHIFT" | "BREAK";
export type AssignmentStatus = "AVAILABLE" | "ASSIGNED";
export type TripStatus = "NOT_STARTED" | "IN_TRANSIT" | "AT_CUSTOMER" | "RETURNING";

export type ActorType =
  | "MANAGER"
  | "DRIVER_SELF_ASSIGN"
  | "SYSTEM"
  | "DRIVER_RELEASE"
  | "MANAGER_OVERRIDE";

export type VehicleType =
  | "BIKE"
  | "SCOOTER"
  | "SMALL_CAR"
  | "MEDIUM_CAR"
  | "LARGE_VAN"
  | "TRUCK";

export type BatchStatus =
  | "SUGGESTED"
  | "APPROVED"
  | "REJECTED"
  | "DISPATCHED"
  | "COMPLETED"
  | "CANCELLED";

// ============================================================================
// Interfaces
// ============================================================================

export interface DeliveryAddress {
  street: string;
  houseNumber: string;
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
  city: string;
  postalCode?: string | null;
  gateCode?: string | null;
  parkingInstructions?: string | null;
  deliveryNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Delivery {
  id: string;
  tenant_id: string;
  branch_id: string;
  order_id: string;
  driver_id?: string | null;
  vehicle_id?: string | null;
  status: DeliveryStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  delivery_address: DeliveryAddress;
  customer_notes?: string | null;
  delivery_notes?: string | null;
  assigned_at?: Date | string | null;
  picked_up_at?: Date | string | null;
  dispatched_at?: Date | string | null;
  arrived_at?: Date | string | null;
  delivered_at?: Date | string | null;
  failed_at?: Date | string | null;
  cancelled_at?: Date | string | null;
  cancellation_reason?: string | null;
  failure_reason?: string | null;
  proof_of_delivery?: {
    photo_url?: string;
    signature_url?: string;
    recipient_name?: string;
    notes?: string;
  } | null;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Driver-facing minimized DTO (PHASE 00 Section 31: Data Minimization)
 * Masks customer financial details, full CRM profile, only provides operationally necessary info.
 */
export interface DeliveryViewDTO {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  priority: string;
  deliveryAddress: DeliveryAddress;
  customerNotes?: string | null;
  deliveryNotes?: string | null;
  assignedAt?: Date | string | null;
  pickedUpAt?: Date | string | null;
  dispatchedAt?: Date | string | null;
  arrivedAt?: Date | string | null;
}

export interface DriverRecord {
  id: string;
  tenant_id: string;
  branch_id: string;
  user_id: string;
  shift_status: ShiftStatus;
  assignment_status: AssignmentStatus;
  trip_status: TripStatus;
  available_since?: Date | string | null;
  is_active: boolean;
  can_self_assign: boolean;
  can_self_batch: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DriverQueueEntry {
  driverId: string;
  userId: string;
  driverName: string;
  shiftStatus: ShiftStatus;
  assignmentStatus: AssignmentStatus;
  tripStatus: TripStatus;
  availableSince: string;
  queuePosition: number;
  canSelfAssign: boolean;
}

export interface DeliveryAssignmentHistoryRecord {
  id: string;
  tenant_id: string;
  delivery_id: string;
  previous_driver_id?: string | null;
  new_driver_id?: string | null;
  actor_type: ActorType;
  actor_id?: string | null;
  reason?: string | null;
  created_at: Date | string;
}

export interface DeliveryBatch {
  id: string;
  tenant_id: string;
  branch_id: string;
  driver_id?: string | null;
  status: BatchStatus;
  strategy: string;
  score: number;
  scoring_breakdown: {
    distanceScore: number;
    directionScore: number;
    kitchenSyncScore: number;
    slaScore: number;
    capacityScore: number;
  };
  delivery_ids: string[];
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: Date | string | null;
  rejected_at?: Date | string | null;
  rejection_reason?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface IntelligenceDecisionLog {
  id: string;
  tenant_id: string;
  branch_id: string;
  decision_type: string;
  candidate_delivery_ids: string[];
  candidate_driver_ids: string[];
  recommendation: any;
  scoring_breakdown: any;
  manager_action?: "APPROVED" | "REJECTED" | "MODIFIED" | "OVERRIDDEN" | null;
  actor_id?: string | null;
  rejection_reason?: string | null;
  algorithm_version: string;
  model_version?: string | null;
  final_outcome?: any | null;
  created_at: Date | string;
  resolved_at?: Date | string | null;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const createDeliverySchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  branchId: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  deliveryAddress: z.object({
    street: z.string().min(1, "Street is required"),
    houseNumber: z.string().min(1, "House number is required"),
    entrance: z.string().optional(),
    floor: z.string().optional(),
    apartment: z.string().optional(),
    city: z.string().min(1, "City is required"),
    postalCode: z.string().optional(),
    gateCode: z.string().optional(),
    parkingInstructions: z.string().optional(),
    deliveryNotes: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  customerNotes: z.string().optional(),
  deliveryNotes: z.string().optional(),
});

export const assignDeliverySchema = z.object({
  driverId: z.string().min(1, "Driver ID is required"),
  vehicleId: z.string().optional(),
  reason: z.string().optional(),
});

export const releaseDeliverySchema = z.object({
  reason: z.string().min(1, "Release reason is required"),
});

export const completeDeliverySchema = z.object({
  proofOfDelivery: z
    .object({
      photoUrl: z.string().optional(),
      signatureUrl: z.string().optional(),
      recipientName: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export const failDeliverySchema = z.object({
  reason: z.string().min(1, "Failure reason is required"),
});

export const suggestBatchSchema = z.object({
  branchId: z.string().optional(),
  maxOrdersPerBatch: z.number().int().min(2).max(10).default(3),
  maxWaitMinutes: z.number().min(1).default(15),
});

export const approveBatchSchema = z.object({
  driverId: z.string().optional(),
});

export const rejectBatchSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});
