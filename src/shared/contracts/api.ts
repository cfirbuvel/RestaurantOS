/**
 * Canonical RestaurantOS API Contracts & Response Envelopes
 * Conforms to RFC 7807 Problem Details for HTTP APIs
 */

export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
  serverDurationMs?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: ApiResponseMeta;
}

export interface ApiListResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  meta: ApiResponseMeta;
}

export interface ApiErrorDetail {
  field?: string;
  issue: string;
  code?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
  requestId: string;
  timestamp: string;
  retryable?: boolean;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

export type OperationSafety =
  | "SAFE_FOR_AUTO_RETRY"       // Idempotent reads or safe syncs: can retry automatically upon network reconnect
  | "IDEMPOTENT_MUTATION"      // State-changing mutations with dedicated Idempotency-Key: retried with SAME key only
  | "UNSAFE_FOR_OFFLINE_REPLAY"; // Non-idempotent or high-concurrency state transitions: MUST NEVER automatically replay on reconnect

export const STANDARD_ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  TENANT_BOUNDARY_VIOLATION: "TENANT_BOUNDARY_VIOLATION",
  BRANCH_MISMATCH: "BRANCH_MISMATCH",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
  OFFLINE_MUTATION_BLOCKED: "OFFLINE_MUTATION_BLOCKED",
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
} as const;

export type StandardErrorCode = typeof STANDARD_ERROR_CODES[keyof typeof STANDARD_ERROR_CODES];
