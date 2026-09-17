import { z } from "zod";
import { cartItemSchema } from "./cart";

export type PaymentMethod = "CREDIT_CARD" | "CASH" | "PAY_AT_COUNTER" | "EMV_TERMINAL";

export const guestCustomerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(9, "Phone number is invalid").regex(/^[0-9+\- ]+$/, "Invalid phone format"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

export const deliveryAddressSchema = z.object({
  city: z.string().min(2, "City is required"),
  street: z.string().min(2, "Street is required"),
  houseNumber: z.string().min(1, "House number is required"),
  floor: z.string().optional(),
  apartment: z.string().optional(),
  entrance: z.string().optional(),
  gateCode: z.string().optional(),
  notes: z.string().max(300).optional(),
});

export const checkoutRequestSchema = z.object({
  items: z.array(cartItemSchema).min(1, "At least one item is required in cart"),
  orderType: z.enum(["DELIVERY", "TAKEAWAY", "DINE_IN"]),
  channel: z.enum(["WEB", "KIOSK"]).default("WEB"),
  customer: guestCustomerSchema,
  deliveryAddress: deliveryAddressSchema.optional(),
  paymentMethod: z.enum(["CREDIT_CARD", "CASH", "PAY_AT_COUNTER", "EMV_TERMINAL"]),
  paymentDetails: z
    .object({
      gateway: z.enum(["MESHULAM", "STRIPE", "MOCK"]).optional(),
      token: z.string().optional(),
      cardLast4: z.string().optional(),
      emvAuthCode: z.string().optional(),
    })
    .optional(),
  couponCode: z.string().optional(),
  tipAmount: z.number().min(0).optional().default(0),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().optional(),
  tableNumber: z.string().optional(), // For kiosk dine-in
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export interface CheckoutResponse {
  success: boolean;
  orderId: string;
  orderNumber: string;
  trackingToken: string;
  trackingUrl: string;
  channel: "WEB" | "KIOSK";
  status: string;
  totalAmount: number;
  discountAmount: number;
  deliveryFee: number;
  paymentStatus: "PAID" | "PENDING" | "PAY_ON_DELIVERY" | "PAY_AT_COUNTER";
  paymentRedirectUrl?: string;
  message?: string;
}
