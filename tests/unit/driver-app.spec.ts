import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { hashPin } from "../../apps/driver-android/src/core/auth/pin-hash";
import { getOneTimeLocation } from "../../apps/driver-android/src/core/location/location-service";
import { driverQueueService } from "@/modules/delivery/services/driver-queue-service";
import { deliveryService } from "@/modules/delivery/services/delivery-service";

describe("Phase 15: Driver Android App Core & Business Rules", () => {
  const tenantId = "org_driver_app_test";
  const branchId = "branch_driver_app_tlv";
  const driverUserId = "usr_drv_1";
  const secondDriverUserId = "usr_drv_2";

  beforeEach(() => {
    memoryDb.reset();
  });

  describe("PIN Security & Hashing", () => {
    it("should produce a consistent 64-character hex hash for the same PIN", async () => {
      const hash1 = await hashPin("1234");
      const hash2 = await hashPin("1234");

      expect(hash1).toBeDefined();
      expect(hash1.length).toBe(64);
      expect(hash1).toBe(hash2);
    });

    it("should produce distinct hashes for different PINs", async () => {
      const hashA = await hashPin("1234");
      const hashB = await hashPin("4321");
      const hashC = await hashPin("0000");

      expect(hashA).not.toBe(hashB);
      expect(hashA).not.toBe(hashC);
      expect(hashB).not.toBe(hashC);
    });
  });

  describe("Shift State Machine", () => {
    it("should walk through full shift lifecycle (OFF_SHIFT -> ON_SHIFT -> BREAK -> RETURN -> OFF_SHIFT)", async () => {
      // 1. Initial state: auto-created as OFF_SHIFT
      const initial = await driverQueueService.getOrCreateDriver(tenantId, branchId, driverUserId);
      expect(initial.shift_status).toBe("OFF_SHIFT");
      expect(initial.assignment_status).toBe("AVAILABLE");

      // 2. Clock In -> ON_SHIFT with available_since timestamp
      const clockedIn = await driverQueueService.clockIn(tenantId, branchId, driverUserId);
      expect(clockedIn.shift_status).toBe("ON_SHIFT");
      expect(clockedIn.available_since).toBeDefined();

      // 3. Break -> BREAK, removed from queue
      const onBreak = await driverQueueService.startBreak(tenantId, branchId, driverUserId);
      expect(onBreak.shift_status).toBe("BREAK");
      expect(onBreak.available_since).toBeNull();

      // 4. Return from Break -> ON_SHIFT, rejoins queue
      const returned = await driverQueueService.returnFromBreak(tenantId, branchId, driverUserId);
      expect(returned.shift_status).toBe("ON_SHIFT");
      expect(returned.available_since).toBeDefined();

      // 5. Clock Out -> OFF_SHIFT
      const clockedOut = await driverQueueService.clockOut(tenantId, branchId, driverUserId);
      expect(clockedOut.shift_status).toBe("OFF_SHIFT");
      expect(clockedOut.available_since).toBeNull();
    });
  });

  describe("Delivery Self-Assignment & Concurrency Protection (409 Conflict)", () => {
    it("should allow a clocked-in driver to self-assign an available delivery", async () => {
      // Clock in driver
      await driverQueueService.clockIn(tenantId, branchId, driverUserId);

      // Create an order & delivery
      const delivery = await deliveryService.createDelivery({
        tenantId,
        branchId,
        orderId: "ord_self_assign_1",
        deliveryAddress: {
          street: "Ibn Gabirol",
          houseNumber: "22",
          city: "Tel Aviv",
        },
      });

      expect(delivery.status).toBe("AVAILABLE_FOR_ASSIGNMENT");

      // Driver self-assigns
      const assigned = await deliveryService.selfAssignDelivery(tenantId, delivery.id, driverUserId);
      expect(assigned.status).toBe("ASSIGNED");
      expect(assigned.driver_id).toBe(driverUserId);

      // Driver status updated to ASSIGNED
      const driver = await driverQueueService.getOrCreateDriver(tenantId, branchId, driverUserId);
      expect(driver.assignment_status).toBe("ASSIGNED");
    });

    it("should throw 409 conflict when a second driver attempts to claim the same delivery", async () => {
      // Clock in both drivers
      await driverQueueService.clockIn(tenantId, branchId, driverUserId);
      await driverQueueService.clockIn(tenantId, branchId, secondDriverUserId);

      const delivery = await deliveryService.createDelivery({
        tenantId,
        branchId,
        orderId: "ord_self_assign_conflict",
        deliveryAddress: {
          street: "Dizengoff",
          houseNumber: "99",
          city: "Tel Aviv",
        },
      });

      // First driver claims
      await deliveryService.selfAssignDelivery(tenantId, delivery.id, driverUserId);

      // Second driver attempts to claim the same delivery -> must throw 409
      let conflictError: any = null;
      try {
        await deliveryService.selfAssignDelivery(tenantId, delivery.id, secondDriverUserId);
      } catch (err: any) {
        conflictError = err;
      }

      expect(conflictError).toBeDefined();
      expect(conflictError.statusCode || conflictError.status).toBe(409);
      expect(conflictError.code).toBe("DELIVERY_ALREADY_ASSIGNED");
    });
  });

  describe("One-Shot Location Service (Battery Friendly)", () => {
    it("should return null gracefully when expo-location is absent without throwing", async () => {
      const fix = await getOneTimeLocation();
      expect(fix).toBeNull();
    });
  });
});
