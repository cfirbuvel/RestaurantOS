import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { DeliveryAddress } from "@/modules/delivery/domain/delivery";

describe("Phase 4: Delivery Lifecycle & State Machine", () => {
  const tenantId = "org-test-delivery";
  const branchId = "branch-test-tlv";
  const driverUserId = "usr-driver-101";
  const managerUserId = "usr-manager-001";
  const orderId = "ord-universal-888";

  const sampleAddress: DeliveryAddress = {
    street: "Dizengoff",
    houseNumber: "50",
    entrance: "B",
    floor: "3",
    apartment: "12",
    city: "Tel Aviv",
    gateCode: "9988",
    deliveryNotes: "Ring doorbell and leave on porch",
    latitude: 32.078,
    longitude: 34.774,
  };

  beforeEach(() => {
    memoryDb.reset();
  });

  it("should create delivery with initial status AVAILABLE_FOR_ASSIGNMENT", async () => {
    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId,
      priority: "HIGH",
      deliveryAddress: sampleAddress,
      customerNotes: "Allergic to nuts",
      deliveryNotes: "Don't ring bell after 9pm",
    });

    expect(delivery.id).toBeDefined();
    expect(delivery.status).toBe("AVAILABLE_FOR_ASSIGNMENT");
    expect(delivery.priority).toBe("HIGH");
    expect(delivery.driver_id).toBeNull();
    expect(delivery.delivery_address.city).toBe("Tel Aviv");
  });

  it("should execute full lifecycle: Assign -> Pickup -> Start (Dispatch) -> Arrive -> Complete", async () => {
    // 1. Create delivery
    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId,
      deliveryAddress: sampleAddress,
    });

    // 2. Manager assigns to driver
    const assigned = await deliveryService.assignDelivery({
      tenantId,
      deliveryId: delivery.id,
      driverId: driverUserId,
      actorId: managerUserId,
      actorType: "MANAGER",
    });
    expect(assigned.status).toBe("ASSIGNED");
    expect(assigned.driver_id).toBe(driverUserId);
    expect(assigned.assigned_at).toBeDefined();

    // 3. Driver picks up order from restaurant
    const pickedUp = await deliveryService.pickupDelivery(tenantId, delivery.id, driverUserId);
    expect(pickedUp.status).toBe("PICKED_UP");
    expect(pickedUp.picked_up_at).toBeDefined();

    // 4. Driver starts trip / out for delivery
    const started = await deliveryService.startDelivery(tenantId, delivery.id, driverUserId);
    expect(started.status).toBe("OUT_FOR_DELIVERY");
    expect(started.dispatched_at).toBeDefined();

    // 5. Driver arrives at customer area (or geofence triggers it)
    const arrived = await deliveryService.arriveDelivery(tenantId, delivery.id, driverUserId);
    expect(arrived.status).toBe("ARRIVED_AT_CUSTOMER_AREA");
    expect(arrived.arrived_at).toBeDefined();

    // 6. Driver completes delivery with proof of delivery
    const completed = await deliveryService.completeDelivery(
      tenantId,
      delivery.id,
      driverUserId,
      {
        signature_url: "https://storage.restaurantos.io/signatures/sig-123.png",
        recipient_name: "Avi Ron",
        notes: "Delivered to hand",
      }
    );
    expect(completed.status).toBe("DELIVERED");
    expect(completed.delivered_at).toBeDefined();
    expect(completed.proof_of_delivery?.recipient_name).toBe("Avi Ron");
  });

  it("should support release flow returning delivery to AVAILABLE_FOR_ASSIGNMENT", async () => {
    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId,
      deliveryAddress: sampleAddress,
    });

    await deliveryService.assignDelivery({
      tenantId,
      deliveryId: delivery.id,
      driverId: driverUserId,
    });

    const released = await deliveryService.releaseDelivery(
      tenantId,
      delivery.id,
      driverUserId,
      "Flat tire on scooter"
    );

    expect(released.status).toBe("AVAILABLE_FOR_ASSIGNMENT");
    expect(released.driver_id).toBeNull();
    expect(released.vehicle_id).toBeNull();

    // Verify assignment history was recorded
    const history = memoryDb.find(
      "delivery_assignment_history",
      (h: any) => h.delivery_id === delivery.id
    );
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[history.length - 1].actor_type).toBe("DRIVER_RELEASE");
    expect(history[history.length - 1].reason).toBe("Flat tire on scooter");
  });

  it("should enforce DeliveryViewDTO data minimization", async () => {
    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId,
      deliveryAddress: sampleAddress,
      customerNotes: "Door code is 9988",
      deliveryNotes: "Call when downstairs",
    });

    const viewDto = deliveryService.toDeliveryViewDTO(delivery);

    // DTO must expose essential navigation and access info
    expect(viewDto.id).toBe(delivery.id);
    expect(viewDto.deliveryAddress.gateCode).toBe("9988");
    expect(viewDto.deliveryAddress.entrance).toBe("B");
    expect(viewDto.deliveryNotes).toBe("Call when downstairs");

    // DTO does not leak raw order pricing, credit card tokens, or internal flags
    expect((viewDto as any).paymentMethod).toBeUndefined();
    expect((viewDto as any).totalAmount).toBeUndefined();
  });

  it("should fail delivery with failure reason", async () => {
    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId,
      deliveryAddress: sampleAddress,
    });

    await deliveryService.assignDelivery({
      tenantId,
      deliveryId: delivery.id,
      driverId: driverUserId,
    });
    await deliveryService.pickupDelivery(tenantId, delivery.id, driverUserId);

    const failed = await deliveryService.failDelivery(
      tenantId,
      delivery.id,
      driverUserId,
      "Customer not at home, unreachable by phone"
    );

    expect(failed.status).toBe("FAILED");
    expect(failed.failure_reason).toBe("Customer not at home, unreachable by phone");
    expect(failed.failed_at).toBeDefined();
  });
});
