import { RestaurantOSClient } from "../../../../../src/shared/api-client/restaurant-os-client";
import { API_CONFIG } from "../../config/api-config";
import { mobileStorage } from "../auth/token-storage";

export const mobileApiClient = new RestaurantOSClient({
  baseUrl: API_CONFIG.baseUrl,
  clientType: API_CONFIG.clientType,
  storageAdapter: mobileStorage,
  timeoutMs: API_CONFIG.timeoutMs,
  maxRetries: API_CONFIG.maxRetries,
  retryDelayMs: API_CONFIG.retryDelayMs,
  enableLogging: true,
});
