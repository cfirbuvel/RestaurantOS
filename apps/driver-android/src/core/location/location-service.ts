// ─── Location Service ─────────────────────────────────────────────────────────
// Posts a SINGLE one-shot GPS fix at key delivery lifecycle events.
// Never starts background tracking. Battery-friendly by design.
// Primary vehicle tracking is handled by 3rd-party hardware GPS devices.

export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

let Platform: any = null;
let ExpoLocation: any = null;

try {
  Platform = require("react-native").Platform;
} catch {
  // Not in react-native environment
}

try {
  ExpoLocation = require("expo-location");
} catch {
  // Not available in test/web environment
}

const TIMEOUT_MS = 8000;

/**
 * Request a single GPS fix from the device.
 * Returns null if permission denied, unavailable, or timed out.
 * The caller must continue with the lifecycle action regardless of this result.
 */
export async function getOneTimeLocation(): Promise<LocationFix | null> {
  if (!ExpoLocation || Platform?.OS === "web") return null;

  try {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.info("[LocationService] Permission not granted — proceeding without GPS fix");
      return null;
    }

    const locationPromise = ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy?.Balanced ?? 3,
    });

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), TIMEOUT_MS)
    );

    const result = await Promise.race([locationPromise, timeoutPromise]);
    if (!result) {
      console.info("[LocationService] GPS fix timed out — proceeding without location");
      return null;
    }

    return {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      accuracy: result.coords.accuracy,
      timestamp: result.timestamp,
    };
  } catch (err) {
    console.warn("[LocationService] Could not obtain GPS fix:", err);
    return null;
  }
}
