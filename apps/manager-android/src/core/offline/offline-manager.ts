import { mobileStorage } from "../auth/token-storage";

export type NetworkStatus = "ONLINE" | "OFFLINE" | "RECONNECTING";

type Listener = (status: NetworkStatus) => void;

class OfflineManager {
  private status: NetworkStatus = "ONLINE";
  private listeners: Set<Listener> = new Set();
  private cachePrefix = "ro_cache_";

  constructor() {
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      try {
        window.addEventListener("online", () => this.setStatus("ONLINE"));
        window.addEventListener("offline", () => this.setStatus("OFFLINE"));
      } catch {
        // Ignored in non-browser environments
      }
    }
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      this.status = navigator.onLine ? "ONLINE" : "OFFLINE";
    }
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  isOnline(): boolean {
    return this.status === "ONLINE";
  }

  setStatus(newStatus: NetworkStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.listeners.forEach((listener) => listener(newStatus));
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /**
   * Safe read-only data caching for offline resilience
   */
  async cacheReadOnlyData<T>(key: string, data: T): Promise<void> {
    try {
      const serialized = JSON.stringify({ data, timestamp: Date.now() });
      await mobileStorage.setItem(`${this.cachePrefix}${key}`, serialized);
    } catch {
      // Storage error ignored
    }
  }

  /**
   * Retrieve cached read-only data when offline
   */
  async getCachedReadOnlyData<T>(key: string): Promise<T | null> {
    try {
      const raw = await mobileStorage.getItem(`${this.cachePrefix}${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.data as T;
    } catch {
      return null;
    }
  }

  /**
   * Verify if a mutation is safe to perform offline.
   * If not safe, throws an error preventing destructive offline writes.
   */
  assertSafeMutation(actionName: string, isDestructive: boolean = true): void {
    if (!this.isOnline() && isDestructive) {
      throw new Error(
        `OFFLINE_MUTATION_BLOCKED: Action '${actionName}' cannot be executed while offline. Please restore connectivity to ensure restaurant state consistency.`
      );
    }
  }
}

export const offlineManager = new OfflineManager();
