// ─── Secure storage abstraction ──────────────────────────────────────────────
// Uses expo-secure-store on device; falls back to in-memory for tests/web.

let Platform: any = null;
let SecureStore: any = null;

try {
  Platform = require("react-native").Platform;
} catch {
  // Not in react-native environment
}

try {
  // Dynamic require to avoid breaking web/test environments
  SecureStore = require("expo-secure-store");
} catch {
  // Not available (web, test env)
}

const memStore: Record<string, string> = {};

export const mobileStorage = {
  async getItem(key: string): Promise<string | null> {
    if (SecureStore && Platform?.OS !== "web") {
      return SecureStore.getItemAsync(key);
    }
    return memStore[key] ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (SecureStore && Platform?.OS !== "web") {
      await SecureStore.setItemAsync(key, value);
    } else {
      memStore[key] = value;
    }
  },

  async removeItem(key: string): Promise<void> {
    if (SecureStore && Platform?.OS !== "web") {
      await SecureStore.deleteItemAsync(key);
    } else {
      delete memStore[key];
    }
  },

  clearMemory(): void {
    for (const k of Object.keys(memStore)) {
      delete memStore[k];
    }
  },
};
