import { z } from "zod";

// ============================================================================
// Enums & Literals
// ============================================================================

export type CallStatus = "RINGING" | "ANSWERED" | "COMPLETED" | "MISSED" | "REJECTED";
export const CALL_STATUSES: CallStatus[] = ["RINGING", "ANSWERED", "COMPLETED", "MISSED", "REJECTED"];

export type CallDirection = "INBOUND" | "OUTBOUND";
export const CALL_DIRECTIONS: CallDirection[] = ["INBOUND", "OUTBOUND"];

// ============================================================================
// Interfaces
// ============================================================================

export interface CallLog {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  call_session_id: string;
  caller_number: string;
  caller_number_raw?: string | null;
  direction: CallDirection;
  status: CallStatus;
  customer_id?: string | null;
  operator_id?: string | null;
  duration_seconds: number;
  started_at: Date | string;
  answered_at?: Date | string | null;
  ended_at?: Date | string | null;
  recording_url?: string | null;
  automated_greeting_played: boolean;
  metadata?: Record<string, any>;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CallerIdCustomerSummary {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  isVip: boolean;
  totalOrdersCount: number;
  totalSpentAmount: number;
  averageOrderValue: number;
  lastOrderAt?: Date | string | null;
  allergies: string[];
  preferences: Record<string, any>;
  internalNotes?: string | null;
}

export interface CallerIdPayload {
  callSessionId: string;
  callerNumber: string;
  callerNumberRaw?: string;
  direction: CallDirection;
  status: CallStatus;
  branchId?: string | null;
  customer: CallerIdCustomerSummary | null;
  recentOrders: Array<{
    id: string;
    orderNumber?: string;
    status: string;
    totalAmount: number;
    createdAt: Date | string;
    itemCount: number;
  }>;
  savedAddresses: Array<{
    id: string;
    street: string;
    houseNumber: string;
    city: string;
    entrance?: string | null;
    floor?: string | null;
    apartment?: string | null;
    isDefault: boolean;
  }>;
  ringTimestamp: string;
}

export interface WebhookIncomingCallPayload {
  sessionId: string;
  callerNumber: string;
  destinationNumber?: string;
  branchId?: string;
  timestamp?: string;
  direction?: CallDirection;
  metadata?: Record<string, any>;
}

export interface WebhookCallStatusPayload {
  sessionId: string;
  status: CallStatus;
  operatorId?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface TelephonyBranchConfig {
  tenantId: string;
  branchId: string;
  automatedGreetingEnabled: boolean;
  greetingAudioUrl?: string | null;
  sipTrunkUsername?: string | null;
  fallbackNumber?: string | null;
  recordCalls: boolean;
}

// ============================================================================
// Phone Normalization Utility (E.164 & Israeli Local)
// ============================================================================

/**
 * Normalizes phone numbers to standard Israeli local (05XXXXXXXX) or E.164 format (+972XXXXXXXXX).
 * Handles Israeli mobile (050, 052, 053, 054, 055, 058) and landline (02, 03, 04, 08, 09, 07x).
 */
export function normalizePhoneNumber(rawPhone: string): {
  normalizedLocal: string;
  e164: string;
  isValid: boolean;
} {
  if (!rawPhone) {
    return { normalizedLocal: "", e164: "", isValid: false };
  }

  // Strip non-digit characters except leading '+'
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, "");

  // If starts with 00, convert to +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // Handle +972 prefix
  if (cleaned.startsWith("+972")) {
    cleaned = cleaned.slice(4);
    if (!cleaned.startsWith("0")) {
      cleaned = "0" + cleaned;
    }
  } else if (cleaned.startsWith("972")) {
    cleaned = cleaned.slice(3);
    if (!cleaned.startsWith("0")) {
      cleaned = "0" + cleaned;
    }
  }

  // Clean leading zeroes if multiple
  if (cleaned.startsWith("00")) {
    cleaned = "0" + cleaned.replace(/^0+/, "");
  }

  // Israeli numbers are usually:
  // Mobile: 10 digits starting with 05
  // Landline: 9 digits starting with 02, 03, 04, 08, 09, 07
  const isIsraeliMobile = /^05\d{8}$/.test(cleaned);
  const isIsraeliLandline = /^0[23489]\d{7}$/.test(cleaned) || /^07\d{7}$/.test(cleaned);
  const isValid = isIsraeliMobile || isIsraeliLandline;

  const normalizedLocal = cleaned;
  const e164 = cleaned.startsWith("0") ? `+972${cleaned.slice(1)}` : `+${cleaned}`;

  return {
    normalizedLocal,
    e164,
    isValid,
  };
}

// ============================================================================
// Validation Schemas
// ============================================================================

export const incomingCallWebhookSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  callerNumber: z.string().min(3, "callerNumber is required"),
  destinationNumber: z.string().optional(),
  branchId: z.string().optional(),
  timestamp: z.string().optional(),
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("INBOUND"),
  metadata: z.record(z.any()).optional(),
});

export const callStatusWebhookSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  status: z.enum(["RINGING", "ANSWERED", "COMPLETED", "MISSED", "REJECTED"]),
  operatorId: z.string().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  recordingUrl: z.string().url().optional().or(z.literal("")),
  timestamp: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const simulateIncomingCallSchema = z.object({
  callerNumber: z.string().min(3, "callerNumber is required"),
  branchId: z.string().optional(),
  destinationNumber: z.string().optional(),
});
