/**
 * RestaurantOS Unified Offline & Connectivity Manager
 * 
 * Supports tri-state status: ONLINE | OFFLINE | RECONNECTING
 * Provides pub/sub for UI listeners and heartbeats.
 */

export type NetworkStatus = "ONLINE" | "OFFLINE" | "RECONNECTING";
type Listener = (status: NetworkStatus) => void;

class OfflineManager {
  private status: NetworkStatus = "ONLINE";
  private listeners: Set<Listener> = new Set();
  private heartbeatInterval: any = null;
  private checkUrl: string = "/api/v1/health";

  public getStatus(): NetworkStatus {
    return this.status;
  }

  public get isOnline(): boolean {
    return this.status === "ONLINE";
  }

  public setStatus(newStatus: NetworkStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notify();
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.status);
      } catch (err) {
        console.error("OfflineManager listener error:", err);
      }
    }
  }

  public startHeartbeat(checkUrl: string = "/api/v1/health", intervalMs: number = 10000): void {
    this.checkUrl = checkUrl;
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(this.checkUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          if (this.status !== "ONLINE") {
            this.setStatus("ONLINE");
          }
        } else {
          if (this.status === "ONLINE") {
            this.setStatus("RECONNECTING");
          }
        }
      } catch {
        if (this.status === "ONLINE") {
          this.setStatus("RECONNECTING");
        } else if (this.status === "RECONNECTING") {
          this.setStatus("OFFLINE");
        }
      }
    }, intervalMs);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const offlineManager = new OfflineManager();
