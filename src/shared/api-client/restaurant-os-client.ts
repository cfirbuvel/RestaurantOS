/**
 * RestaurantOS Unified Platform-Neutral API Client
 *
 * Implements:
 * - Standardized Request Envelopes & RFC 7807 Problem Details
 * - Deterministic Idempotency Key Semantics (reused on retry, fresh on new operation)
 * - Safe Offline Classification & Replay Prevention
 * - Exponential Backoff Retries with Jitter for Transient Errors
 * - Redacted Safe Logging
 * - Zero Browser/DOM Globals (Node / React Native / Web compatible)
 */

import {
  ClientType,
  CLIENT_HEADERS,
} from "../contracts/client-types";
import {
  ApiResponse,
  ApiListResponse,
  ApiErrorResponse,
  ApiErrorPayload,
  OperationSafety,
  STANDARD_ERROR_CODES,
  StandardErrorCode,
} from "../contracts/api";

export interface IStorageAdapter {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export class InMemoryStorageAdapter implements IStorageAdapter {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

export class RestaurantOSApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Array<{ field?: string; issue: string; code?: string }>;
  public readonly requestId: string;
  public readonly timestamp: string;
  public readonly isRetryable: boolean;

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.message || `API Error: ${payload.code}`);
    this.name = "RestaurantOSApiError";
    this.code = payload.code;
    this.status = status;
    this.details = payload.details;
    this.requestId = payload.requestId || "unknown_request";
    this.timestamp = payload.timestamp || new Date().toISOString();

    // 5xx and 429 are typically transient; 4xx are client errors and non-retryable
    this.isRetryable = status === 429 || (status >= 500 && status <= 504);
  }
}

export interface ClientConfig {
  baseUrl: string;
  clientType: ClientType;
  tenantId?: string;
  branchId?: string;
  deviceId?: string;
  token?: string;
  storageAdapter?: IStorageAdapter;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  onUnauthorized?: () => Promise<string | null> | void; // Callback for token refresh
  fetchFn?: typeof fetch;
  enableLogging?: boolean;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: any;
  idempotencyKey?: string;
  timeoutMs?: number;
  retries?: number;
  safety?: OperationSafety;
  skipAuth?: boolean;
}

function safeRandomUUID(): string {
  if (typeof globalThis !== "undefined" && typeof (globalThis as any).crypto?.randomUUID === "function") {
    try {
      return (globalThis as any).crypto.randomUUID();
    } catch {
      // Fallback to random generator
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class RestaurantOSClient {
  private config: Required<
    Omit<ClientConfig, "tenantId" | "branchId" | "deviceId" | "token" | "onUnauthorized">
  > & {
    tenantId?: string;
    branchId?: string;
    deviceId?: string;
    token?: string;
    onUnauthorized?: () => Promise<string | null> | void;
  };

  private isNetworkOnline: boolean = true;

  constructor(config: ClientConfig) {
    const resolvedFetch =
      config.fetchFn ||
      (typeof window !== "undefined" && typeof window.fetch === "function"
        ? window.fetch.bind(window)
        : typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
        ? globalThis.fetch.bind(globalThis)
        : typeof fetch === "function"
        ? fetch
        : undefined);

    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      clientType: config.clientType,
      tenantId: config.tenantId,
      branchId: config.branchId,
      deviceId: config.deviceId,
      token: config.token,
      storageAdapter: config.storageAdapter || new InMemoryStorageAdapter(),
      timeoutMs: config.timeoutMs ?? 15000,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 300,
      onUnauthorized: config.onUnauthorized,
      fetchFn: resolvedFetch as any,
      enableLogging: config.enableLogging ?? false,
    };
  }

  public setTenantId(tenantId: string | undefined) {
    this.config.tenantId = tenantId;
  }

  public setBranchId(branchId: string | undefined) {
    this.config.branchId = branchId;
  }

  public setDeviceId(deviceId: string | undefined) {
    this.config.deviceId = deviceId;
  }

  public setToken(token: string | undefined) {
    this.config.token = token;
  }

  public setOnline(isOnline: boolean) {
    this.isNetworkOnline = isOnline;
  }

  public isOnline(): boolean {
    return this.isNetworkOnline;
  }

  public getContext() {
    return {
      clientType: this.config.clientType,
      tenantId: this.config.tenantId,
      branchId: this.config.branchId,
      deviceId: this.config.deviceId,
      isOnline: this.isNetworkOnline,
    };
  }

  // ==========================================================================
  // HTTP Methods
  // ==========================================================================

  public async get<T = any>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("GET", path, {
      ...options,
      safety: options?.safety || "SAFE_FOR_AUTO_RETRY",
    });
  }

  public async getList<T = any>(path: string, options?: RequestOptions): Promise<ApiListResponse<T>> {
    return this.request<ApiListResponse<T>>("GET", path, {
      ...options,
      safety: options?.safety || "SAFE_FOR_AUTO_RETRY",
    });
  }

  public async post<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.executeMutation<T>("POST", path, body, options);
  }

  public async put<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.executeMutation<T>("PUT", path, body, options);
  }

  public async patch<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.executeMutation<T>("PATCH", path, body, options);
  }

  public async delete<T = any>(path: string, options?: RequestOptions): Promise<T> {
    return this.executeMutation<T>("DELETE", path, undefined, options);
  }

  // ==========================================================================
  // Mutation & Idempotency Execution
  // ==========================================================================

  /**
   * Execute state-changing mutation with explicit idempotency key semantics:
   * 1. New logical operation -> Generates or accepts a new idempotency key.
   * 2. Retry of the SAME logical operation -> Reuses the exact same idempotency key.
   * 3. Offline safety -> If offline and operation is unsafe, fails fast without queueing.
   */
  private async executeMutation<T>(
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: any,
    options?: RequestOptions
  ): Promise<T> {
    // 1. Offline check
    const safety = options?.safety ?? "UNSAFE_FOR_OFFLINE_REPLAY";
    if (!this.isNetworkOnline && safety === "UNSAFE_FOR_OFFLINE_REPLAY") {
      throw new RestaurantOSApiError(
        {
          code: STANDARD_ERROR_CODES.OFFLINE_MUTATION_BLOCKED,
          message: `Network offline: Unsafe mutation '${method} ${path}' blocked from auto-replay.`,
          requestId: `offline_${safeRandomUUID()}`,
          timestamp: new Date().toISOString(),
          retryable: false,
        },
        0
      );
    }

    // 2. Generate or reuse idempotency key for this logical operation
    // If client supplied an idempotency key (meaning this logical action has an identity),
    // we keep and reuse it across any retries of this request.
    const idempotencyKey = options?.idempotencyKey || `idem_${safeRandomUUID()}`;

    return this.request<T>(method, path, {
      ...options,
      body,
      idempotencyKey,
      safety,
    });
  }

  // ==========================================================================
  // Core Request Execution & Retry Pipeline
  // ==========================================================================

  private async request<T>(
    method: string,
    path: string,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const maxRetries = options?.retries ?? this.config.maxRetries;
    const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
    const idempotencyKey = options?.idempotencyKey;

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      attempt++;
      const requestId = `req_${safeRandomUUID().replace(/-/g, "").substring(0, 16)}`;

      try {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          accept: "application/json",
          [CLIENT_HEADERS.CLIENT_TYPE]: this.config.clientType,
          [CLIENT_HEADERS.REQUEST_ID]: requestId,
          ...options?.headers,
        };

        if (this.config.tenantId) {
          headers[CLIENT_HEADERS.TENANT_ID] = this.config.tenantId;
        }
        if (this.config.branchId) {
          headers[CLIENT_HEADERS.BRANCH_ID] = this.config.branchId;
        }
        if (this.config.deviceId) {
          headers[CLIENT_HEADERS.DEVICE_ID] = this.config.deviceId;
        }
        if (idempotencyKey) {
          headers[CLIENT_HEADERS.IDEMPOTENCY_KEY] = idempotencyKey;
        }

        // Authentication token injection
        if (!options?.skipAuth && this.config.token) {
          headers["authorization"] = `Bearer ${this.config.token}`;
        }

        this.logSafe("REQUEST", { method, url, requestId, idempotencyKey, attempt });

        // Request with timeout via AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        const fetchImpl = this.config.fetchFn;
        const globalScope = typeof window !== "undefined" ? window : globalThis;
        try {
          response = await fetchImpl.call(globalScope, url, {
            method,
            headers,
            body: options?.body ? JSON.stringify(options.body) : undefined,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        // Handle 401 Unauthorized with potential token refresh
        if (response.status === 401 && this.config.onUnauthorized && attempt === 1) {
          this.logSafe("AUTH_REFRESH_ATTEMPT", { path });
          const newToken = await this.config.onUnauthorized();
          if (newToken) {
            this.config.token = newToken;
            // Retry immediately once with new token
            continue;
          }
        }

        // Parse Response
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          const errorPayload: ApiErrorPayload = responseBody?.error || {
            code: this.mapStatusToErrorCode(response.status),
            message: responseBody?.message || `HTTP error ${response.status}`,
            requestId,
            timestamp: new Date().toISOString(),
          };

          const apiError = new RestaurantOSApiError(errorPayload, response.status);
          this.logSafe("ERROR_RESPONSE", { status: response.status, code: apiError.code, requestId });

          // Non-retryable status codes fail immediately
          if (!apiError.isRetryable || attempt > maxRetries) {
            throw apiError;
          }

          lastError = apiError;
        } else {
          this.logSafe("SUCCESS_RESPONSE", { status: response.status, requestId });
          return responseBody as T;
        }
      } catch (err: any) {
        lastError = err;

        // Determine if error is a timeout or network failure
        const isAbort = err?.name === "AbortError";
        const isNetworkErr = isAbort || err instanceof TypeError || err?.code === "ENOTFOUND" || err?.code === "ECONNREFUSED";

        if (isAbort) {
          lastError = new RestaurantOSApiError(
            {
              code: STANDARD_ERROR_CODES.TIMEOUT_ERROR,
              message: `Request timed out after ${timeoutMs}ms`,
              requestId,
              timestamp: new Date().toISOString(),
              retryable: true,
            },
            408
          );
        } else if (isNetworkErr && !(err instanceof RestaurantOSApiError)) {
          lastError = new RestaurantOSApiError(
            {
              code: STANDARD_ERROR_CODES.NETWORK_ERROR,
              message: err?.message || "Network connection failure",
              requestId,
              timestamp: new Date().toISOString(),
              retryable: true,
            },
            0
          );
        }

        // If not retryable or max attempts exhausted, rethrow
        if (lastError instanceof RestaurantOSApiError && !lastError.isRetryable) {
          throw lastError;
        }

        if (attempt > maxRetries) {
          throw lastError;
        }

        // Exponential backoff with jitter before retrying the exact same request
        // (CRITICAL: Same idempotencyKey is preserved!)
        const backoffMs = this.config.retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 50;
        this.logSafe("RETRY_WAIT", { attempt, backoffMs, path });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError || new Error("Unknown request execution failure");
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    let fullUrl = `${this.config.baseUrl}${cleanPath}`;

    if (query) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
      }
    }

    return fullUrl;
  }

  private mapStatusToErrorCode(status: number): StandardErrorCode {
    switch (status) {
      case 400: return STANDARD_ERROR_CODES.BAD_REQUEST;
      case 401: return STANDARD_ERROR_CODES.UNAUTHORIZED;
      case 403: return STANDARD_ERROR_CODES.FORBIDDEN;
      case 404: return STANDARD_ERROR_CODES.NOT_FOUND;
      case 409: return STANDARD_ERROR_CODES.CONFLICT;
      case 422: return STANDARD_ERROR_CODES.VALIDATION_FAILED;
      case 429: return STANDARD_ERROR_CODES.RATE_LIMITED;
      default: return STANDARD_ERROR_CODES.INTERNAL_ERROR;
    }
  }

  private logSafe(tag: string, data: Record<string, any>) {
    if (!this.config.enableLogging) return;

    const SENSITIVE_KEYS = ["password", "token", "authorization", "secret", "pin", "creditcard", "phone"];
    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = "[REDACTED]";
      }
    }

    console.log(`[RestaurantOSClient:${tag}]`, JSON.stringify(sanitized));
  }
}
