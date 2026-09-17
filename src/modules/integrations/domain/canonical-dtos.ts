import { z } from "zod";

// ── 1. Canonical External Order DTOs ──────────────────────────────────────────

export const UniversalModifierSchema = z.object({
  externalModifierId: z.string().optional(),
  name: z.string().min(1),
  price: z.number().default(0),
});
export type UniversalModifierDTO = z.infer<typeof UniversalModifierSchema>;

export const UniversalOrderItemSchema = z.object({
  externalItemId: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  notes: z.string().optional(),
  selectedModifiers: z.array(UniversalModifierSchema).default([]),
});
export type UniversalOrderItemDTO = z.infer<typeof UniversalOrderItemSchema>;

export const UniversalAddressSchema = z.object({
  street: z.string().min(1),
  streetNumber: z.string().optional(),
  city: z.string().min(1),
  apartment: z.string().optional(),
  floor: z.string().optional(),
  entryCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  deliveryInstructions: z.string().optional(),
});
export type UniversalAddressDTO = z.infer<typeof UniversalAddressSchema>;

export const UniversalCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  address: UniversalAddressSchema.optional(),
});
export type UniversalCustomerDTO = z.infer<typeof UniversalCustomerSchema>;

export const UniversalFinancialsSchema = z.object({
  subtotal: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().default(0),
  deliveryFee: z.number().nonnegative().default(0),
  tipAmount: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  totalAmount: z.number().nonnegative(),
  currency: z.string().default("ILS"),
});
export type UniversalFinancialsDTO = z.infer<typeof UniversalFinancialsSchema>;

export const UniversalExternalOrderSchema = z.object({
  provider: z.enum(["WOLT", "TENBIS", "MISHLOHA"]),
  externalOrderId: z.string().min(1),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  customer: UniversalCustomerSchema,
  items: z.array(UniversalOrderItemSchema).min(1),
  financials: UniversalFinancialsSchema,
  fulfillmentType: z.enum(["DELIVERY", "PICKUP"]),
  estimatedReadyTime: z.union([z.string(), z.date()]).optional(),
  deliveryNotes: z.string().optional(),
  kitchenNotes: z.string().optional(),
  rawMetadata: z.record(z.any()).default({}),
});
export type UniversalExternalOrderDTO = z.infer<typeof UniversalExternalOrderSchema>;

// ── 2. Canonical Fiscal / Invoicing DTOs ──────────────────────────────────────

export const UniversalInvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
  vatRate: z.number().default(0.17), // 17% standard Israeli VAT
  totalAmount: z.number().nonnegative(),
});
export type UniversalInvoiceItemDTO = z.infer<typeof UniversalInvoiceItemSchema>;

export const UniversalInvoiceSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  orderId: z.string().optional(),
  invoiceType: z.enum(["TAX_INVOICE", "RECEIPT", "TAX_INVOICE_RECEIPT", "CREDIT_NOTE"]),
  recipient: z.object({
    name: z.string().min(1),
    taxId: z.string().optional(), // H.P. / Israeli ID
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
  items: z.array(UniversalInvoiceItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  vatAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  currency: z.string().default("ILS"),
  paymentDetails: z
    .object({
      method: z.string(), // "CREDIT_CARD", "CASH", "APP", etc.
      amount: z.number().nonnegative(),
      referenceId: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).default({}),
});
export type UniversalInvoiceDTO = z.infer<typeof UniversalInvoiceSchema>;

export interface InvoiceResult {
  success: boolean;
  invoiceId?: string;
  documentNumber?: string;
  pdfUrl?: string;
  documentType?: string;
  issuedAt?: string;
  error?: string;
  rawResponse?: any;
}

// ── 3. Canonical Payment DTOs ────────────────────────────────────────────────

export const UniversalPaymentSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  orderId: z.string().optional(),
  provider: z.enum(["MESHULAM", "STRIPE"]),
  amount: z.number().positive(),
  currency: z.enum(["ILS", "USD", "EUR"]).default("ILS"),
  token: z.string().optional(),
  cardDetails: z
    .object({
      cardNumber: z.string().optional(),
      expMonth: z.string().optional(),
      expYear: z.string().optional(),
      cvv: z.string().optional(),
      holderName: z.string().optional(),
      holderId: z.string().optional(), // Israeli Teudat Zehut for Meshulam
    })
    .optional(),
  paymentMethod: z
    .enum(["CREDIT_CARD", "BIT", "APPLE_PAY", "GOOGLE_PAY"])
    .default("CREDIT_CARD"),
  installments: z.number().int().min(1).default(1),
  capture: z.boolean().default(true),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).default({}),
});
export type UniversalPaymentDTO = z.infer<typeof UniversalPaymentSchema>;

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  status: "PAID" | "AUTHORIZED" | "FAILED";
  approvalCode?: string;
  token?: string;
  lastFourDigits?: string;
  cardBrand?: string;
  amount?: number;
  currency?: string;
  error?: string;
  rawResponse?: any;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  currency?: string;
  error?: string;
  rawResponse?: any;
}
