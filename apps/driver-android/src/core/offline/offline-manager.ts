import { Platform } from "react-native";

// ─── Offline manager ─────────────────────────────────────────────────────────
// Listens for network state changes.
// NetInfo from @react-native-community/netinfo is ideal for production;
// this implementation uses a polling fallback that works with Expo Go.

type Listener = (isOnline: boolean) => void;

class OfflineManager {
  private _isOnline = true;
  private _listeners: Set<Listener> = new Set();
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  get isOnline() {
    return this._isOnline;
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private emit(online: boolean) {
    if (online !== this._isOnline) {
      this._isOnline = online;
      this._listeners.forEach((l) => l(online));
    }
  }

  start() {
    if (Platform.OS === "web" || this._pollInterval) return;

    // Poll the backend health every 10s to detect connectivity
    this._pollInterval = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        await fetch("https://clients3.google.com/generate_204", {
          method: "HEAD",
          signal: controller.signal,
          cache: "no-cache",
        });
        clearTimeout(timer);
        this.emit(true);
      } catch {
        this.emit(false);
      }
    }, 10_000);
  }

  stop() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }
}

export const offlineManager = new OfflineManager();
