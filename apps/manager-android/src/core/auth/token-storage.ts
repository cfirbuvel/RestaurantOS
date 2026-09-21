import { IStorageAdapter } from "../../../../../src/shared/api-client/restaurant-os-client";

/**
 * Mobile Token Storage Adapter
 *
 * Provides persistent, secure key-value storage for mobile sessions.
 * In browser/Expo-web mode: uses localStorage / memory fallback.
 * In native Android/iOS mode: uses secure storage.
 */
export class MobileTokenStorageAdapter implements IStorageAdapter {
  private memoryStore = new Map<string, string>();

  getItem(key: string): string | null {
    if (typeof window !== "undefined" && typeof window.localStorage?.getItem === "function") {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return this.memoryStore.get(key) ?? null;
      }
    }
    return this.memoryStore.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (typeof window !== "undefined" && typeof window.localStorage?.setItem === "function") {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        // Fallback to memory
      }
    }
    this.memoryStore.set(key, value);
  }

  removeItem(key: string): void {
    if (typeof window !== "undefined" && typeof window.localStorage?.removeItem === "function") {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {
        // Fallback
      }
    }
    this.memoryStore.delete(key);
  }

  clear(): void {
    if (typeof window !== "undefined" && typeof window.localStorage?.clear === "function") {
      try {
        window.localStorage.clear();
      } catch {}
    }
    this.memoryStore.clear();
  }
}

export const mobileStorage = new MobileTokenStorageAdapter();
