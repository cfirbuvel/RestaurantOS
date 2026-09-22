import { API_CONFIG } from "../../config/api-config";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RequestOptions {
  skipAuth?: boolean;
  headers?: Record<string, string>;
}

// ─── Mobile API Client ───────────────────────────────────────────────────────

class MobileApiClient {
  private token: string = "";
  private branchId: string = "";
  private baseUrl: string = API_CONFIG.BASE_URL;

  setToken(token: string) {
    this.token = token;
  }

  setBranchId(branchId: string) {
    this.branchId = branchId;
  }

  private buildHeaders(options?: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options?.headers,
    };
    if (!options?.skipAuth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    if (this.branchId) {
      headers["X-Branch-Id"] = this.branchId;
    }
    return headers;
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.buildHeaders(options),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err: any = new Error(body?.error?.message || body?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return res.json();
  }

  async post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.buildHeaders(options),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err: any = new Error(errBody?.error?.message || errBody?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = errBody;
      throw err;
    }
    return res.json();
  }

  async patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: this.buildHeaders(options),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err: any = new Error(errBody?.error?.message || errBody?.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getToken(): string {
    return this.token;
  }
}

export const mobileApiClient = new MobileApiClient();
