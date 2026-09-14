import { z } from "zod";

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "ACCEPTED"
  | "IN_PREPARATION"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type OrderChannel =
  | "WEB"
  | "POS"
  | "KIOSK"
  | "PHONE"
  | "WOLT"
  | "TENBIS"
  | "MISHLOHA"
  | "MANUAL";

export type OrderType =
  | "DINE_IN"
  | "TAKEAWAY"
  | "DELIVERY"
  | "DRIVE_THRU"
  | "CURBSIDE";

export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED"
  | "VOIDED";

export interface SelectedModifier {
  modifier_id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string | null;
  selected_modifiers: SelectedModifier[];
}

export interface Order {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id?: string | null;
  order_number: string;
  channel: OrderChannel;
  order_type: OrderType;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  delivery_fee: number;
  tip_amount: number;
  total_amount: number;
  currency: string;
  notes?: string | null;
  kitchen_notes?: string | null;
  delivery_address_id?: string | null;
  estimated_ready_at?: Date | string | null;
  actual_ready_at?: Date | string | null;
  completed_at?: Date | string | null;
  cancelled_at?: Date | string | null;
  cancellation_reason?: string | null;
  external_order_id?: string | null;
  metadata?: Record<string, any>;
  created_by?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
  items?: OrderItem[];
}

/**
 * Valid transitions map for Universal Order lifecycle
 * (PHASE 00 Section 3 — Decoupled from transport delivery)
 */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED", "FAILED"],
  CONFIRMED: ["ACCEPTED", "CANCELLED", "FAILED"],
  ACCEPTED: ["IN_PREPARATION", "CANCELLED", "FAILED"],
  IN_PREPARATION: ["READY", "CANCELLED", "FAILED"],
  READY: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

export function canTransitionOrder(current: OrderStatus, target: OrderStatus): boolean {
  return VALID_ORDER_TRANSITIONS[current]?.includes(target) ?? false;
}

export const createOrderItemSchema = z.object({
  productId: z.string().min(1, "Product ID required"),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().positive("Quantity must be positive"),
  notes: z.string().optional(),
  selectedModifiers: z
    .array(
      z.object({
        modifierId: z.string().min(1),
      })
    )
    .optional(),
});

export const createOrderSchema = z.object({
  branchId: z.string().min(1, "Branch ID required"),
  customerId: z.string().optional().nullable(),
  channel: z.enum([
    "WEB",
    "POS",
    "KIOSK",
    "PHONE",
    "WOLT",
    "TENBIS",
    "MISHLOHA",
    "MANUAL",
  ]),
  orderType: z.enum([
    "DINE_IN",
    "TAKEAWAY",
    "DELIVERY",
    "DRIVE_THRU",
    "CURBSIDE",
  ]),
  items: z.array(createOrderItemSchema).min(1, "Order must contain at least one item"),
  deliveryAddressId: z.string().optional().nullable(),
  notes: z.string().optional(),
  kitchenNotes: z.string().optional(),
  discountAmount: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(0),
  tipAmount: z.number().min(0).default(0),
  externalOrderId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  autoConfirm: z.boolean().default(false),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required"),
});

export const acceptOrderSchema = z.object({
  estimatedPrepMinutes: z.number().int().positive().default(20),
});
