import { Platform } from "react-native";

const getDefaultBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // On Android physical device / Expo Go or emulator, reach local dev backend
  if (Platform.OS === "android") {
    return "http://192.168.1.145:3000";
  }
  return "http://localhost:3000";
};

export const API_CONFIG = {
  baseUrl: getDefaultBaseUrl(),
  timeoutMs: 15000,
  maxRetries: 3,
  retryDelayMs: 1000,
  clientType: "MANAGER_APP" as const,
};
