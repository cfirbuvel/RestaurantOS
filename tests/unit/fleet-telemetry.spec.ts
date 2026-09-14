import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { fleetService, MockTrackerAdapter } from "@/modules/fleet/services/fleet-service";
import { deliveryService } from "@/modules/delivery/services/delivery-service";

describe("Phase 4: Fleet & Telematics Subsystem", () => {
  const tenantId = "org-fleet-test";
  const branchId = "branch-fleet-tlv";
  const driverUserId = "usr-driver-202";

  beforeEach(() => {
    memoryDb.reset();
  });

  it("should register and list vehicles for a branch", async () => {
    const vehicle1 = await fleetService.createVehicle(tenantId, branchId, {
      vehicleType: "SCOOTER",
      licensePlate: "11-222-33",
      make: "Yamaha",
      model: "NMAX 155",
      capacity: 2,
    });

    const vehicle2 = await fleetService.createVehicle(tenantId, branchId, {
      vehicleType: "BIKE",
      licensePlate: "EB-101",
      capacity: 1,
    });

    const list = await fleetService.listVehicles(tenantId, branchId);
    expect(list).toHaveLength(2);
    expect(list.some((v) => v.license_plate === "11-222-33")).toBe(true);
    expect(list.some((v) => v.license_plate === "EB-101")).toBe(true);
  });

  it("should handle temporal driver and tracker assignments to vehicle", async () => {
    const vehicle = await fleetService.createVehicle(tenantId, branchId, {
      vehicleType: "SCOOTER",
      licensePlate: "44-555-66",
    });

    // 1. Assign driver to vehicle
    const driverAssignment = await fleetService.assignDriverToVehicle(
      tenantId,
      driverUserId,
      vehicle.id,
      "usr-manager-1"
    );
    expect(driverAssignment.vehicle_id).toBe(vehicle.id);
    expect(driverAssignment.driver_id).toBe(driverUserId);
    expect(driverAssignment.unassigned_at).toBeNull();

    // 2. Mount tracker on vehicle
    const trackerId = "trk-iot-9900";
    const trackerAssignment = await fleetService.assignTrackerToVehicle(
      tenantId,
      vehicle.id,
      trackerId,
      "usr-manager-1"
    );
    expect(trackerAssignment.vehicle_id).toBe(vehicle.id);
    expect(trackerAssignment.tracker_id).toBe(trackerId);
    expect(trackerAssignment.unassigned_at).toBeNull();

    // 3. Re-assigning tracker to another vehicle unmounts it from the first
    const vehicle2 = await fleetService.createVehicle(tenantId, branchId, {
      vehicleType: "SCOOTER",
      licensePlate: "77-888-99",
    });
    await fleetService.assignTrackerToVehicle(tenantId, vehicle2.id, trackerId, "usr-manager-1");

    const previousAssignments = memoryDb.find(
      "vehicle_tracker_assignments",
      (a: any) => a.vehicle_id === vehicle.id && a.tracker_id === trackerId
    );
    expect(previousAssignments[0].unassigned_at).not.toBeNull();
  });

  it("should normalize raw telemetry using MockTrackerAdapter", () => {
    const adapter = new MockTrackerAdapter();
    const normalized = adapter.normalizeTelemetry({
      trackerId: "trk-001",
      latitude: "32.085",
      longitude: "34.781",
      speedKmh: "42.5",
      batteryLevel: "88",
    });

    expect(normalized.trackerId).toBe("trk-001");
    expect(normalized.latitude).toBe(32.085);
    expect(normalized.longitude).toBe(34.781);
    expect(normalized.speedKmh).toBe(42.5);
    expect(normalized.batteryLevel).toBe(88);
  });

  it("should evaluate geofence: enter customer geofence transitions to ARRIVED_AT_CUSTOMER_AREA but NEVER to DELIVERED", async () => {
    const trackerId = "trk-geo-01";

    // Create vehicle and mount tracker
    const vehicle = await fleetService.createVehicle(tenantId, branchId, {
      vehicleType: "SCOOTER",
      licensePlate: "99-000-11",
    });
    await fleetService.assignTrackerToVehicle(tenantId, vehicle.id, trackerId);

    // Customer delivery destination: 32.0625, 34.7702
    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: "ord-geo-1",
      deliveryAddress: {
        street: "Herzl",
        houseNumber: "10",
        city: "Tel Aviv",
        latitude: 32.0625,
        longitude: 34.7702,
      },
    });

    // Assign to driver with vehicle, pick up, and dispatch out for delivery
    await deliveryService.assignDelivery({
      tenantId,
      deliveryId: delivery.id,
      driverId: driverUserId,
      vehicleId: vehicle.id,
    });
    await deliveryService.pickupDelivery(tenantId, delivery.id, driverUserId);
    await deliveryService.startDelivery(tenantId, delivery.id, driverUserId);

    // 1. Ingest telemetry far away (distance > 500m)
    const farResult = await fleetService.ingestTelemetry(tenantId, {
      trackerId,
      latitude: 32.075, // ~1.4 km away
      longitude: 34.775,
      speedKmh: 35,
      recordedAt: new Date(),
    });
    expect(farResult.geofenceTriggered).toBe(false);

    let currentDelivery = await deliveryService.getDeliveryById(tenantId, delivery.id);
    expect(currentDelivery?.status).toBe("OUT_FOR_DELIVERY");

    // 2. Ingest telemetry within 100 meters of customer destination
    const nearResult = await fleetService.ingestTelemetry(tenantId, {
      trackerId,
      latitude: 32.0626, // ~20 meters away
      longitude: 34.7703,
      speedKmh: 5,
      recordedAt: new Date(),
    });
    expect(nearResult.geofenceTriggered).toBe(true);
    expect(nearResult.transitionedDeliveryId).toBe(delivery.id);

    currentDelivery = await deliveryService.getDeliveryById(tenantId, delivery.id);
    // CRITICAL: Must be ARRIVED_AT_CUSTOMER_AREA, NEVER automatically DELIVERED
    expect(currentDelivery?.status).toBe("ARRIVED_AT_CUSTOMER_AREA");
    expect(currentDelivery?.status).not.toBe("DELIVERED");
  });
});
