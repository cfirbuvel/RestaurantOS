import { describe, it, expect, vi, beforeEach } from "vitest";
import { MobileTokenStorageAdapter } from "@/../apps/manager-android/src/core/auth/token-storage";
import { offlineManager } from "@/../apps/manager-android/src/core/offline/offline-manager";
import { translations } from "@/../apps/manager-android/src/core/i18n/translations";
import { RestaurantOSClient } from "@/shared/api-client/restaurant-os-client";
import { CLIENT_HEADERS } from "@/shared/contracts/client-types";

describe("Phase 14: Mobile Manager Client Core Services", () => {
  describe("MobileTokenStorageAdapter", () => {
    it("should store, retrieve, and remove auth tokens securely", async () => {
      const storage = new MobileTokenStorageAdapter();
      storage.setItem("test_key", "secret_jwt_token_123");

      expect(storage.getItem("test_key")).toBe("secret_jwt_token_123");

      storage.removeItem("test_key");
      expect(storage.getItem("test_key")).toBeNull();
    });
  });

  describe("OfflineManager & Safe Mutation Guard", () => {
    beforeEach(() => {
      offlineManager.setStatus("ONLINE");
    });

    it("should allow safe mutations when ONLINE", () => {
      expect(() => {
        offlineManager.assertSafeMutation("order.accept", true);
      }).not.toThrow();
    });

    it("should block destructive mutations when OFFLINE to prevent state divergence", () => {
      offlineManager.setStatus("OFFLINE");

      expect(() => {
        offlineManager.assertSafeMutation("delivery.assign", true);
      }).toThrowError(/OFFLINE_MUTATION_BLOCKED/);
    });

    it("should cache and retrieve read-only operational data for offline viewing", async () => {
      const testData = {
        ordersCount: 42,
        activeDeliveries: 5,
        driversAvailable: 3,
      };

      await offlineManager.cacheReadOnlyData("dashboard_test", testData);
      const retrieved = await offlineManager.getCachedReadOnlyData<typeof testData>("dashboard_test");

      expect(retrieved).toEqual(testData);
    });
  });

  describe("Bilingual Dictionary (Hebrew RTL & English)", () => {
    it("should have complete translation keys in Hebrew matching English", () => {
      const heKeys = Object.keys(translations.he);
      const enKeys = Object.keys(translations.en);

      expect(heKeys.length).toBeGreaterThan(50);
      expect(enKeys.length).toBe(heKeys.length);

      // Verify specific operational keywords
      expect(translations.he.dashboardTitle).toBe("שליטה מבצעית חיה");
      expect(translations.he.currency).toBe("₪");
      expect(translations.he.assignDriver).toBe("שייך שליח");
      expect(translations.he.slaWarnings).toBe("חריגות SLA");
    });
  });

  describe("Manager Mobile API Client Integration", () => {
    it("should inject MANAGER_APP client type and authorization header", async () => {
      let headersPassed: Record<string, string> = {};

      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        headersPassed = (init?.headers as Record<string, string>) || {};
        return new Response(
          JSON.stringify({ success: true, data: { status: "ready" } }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      });

      const client = new RestaurantOSClient({
        baseUrl: "https://api.restaurantos.local",
        clientType: "MANAGER_APP",
        tenantId: "tenant_tlv_1",
        branchId: "branch_dizengoff",
        token: "mgr_session_token_xyz",
        fetchFn: mockFetch as any,
      });

      await client.get("/api/v1/analytics/operational-overview");

      expect(headersPassed[CLIENT_HEADERS.CLIENT_TYPE]).toBe("MANAGER_APP");
      expect(headersPassed[CLIENT_HEADERS.TENANT_ID]).toBe("tenant_tlv_1");
      expect(headersPassed[CLIENT_HEADERS.BRANCH_ID]).toBe("branch_dizengoff");
      expect(headersPassed["authorization"]).toBe("Bearer mgr_session_token_xyz");
    });
  });
});
