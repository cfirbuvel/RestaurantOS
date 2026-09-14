import { memoryDb, getPostgresPool } from "@/core/database/db";
import { VehicleType } from "@/modules/delivery/domain/delivery";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { auditLogger } from "@/core/audit/audit-logger";

// ============================================================================
// Fleet Interfaces & Telemetry Contracts
// ============================================================================

export interface VehicleRecord {
  id: string;
  tenant_id: string;
  branch_id: string;
  vehicle_type: VehicleType;
  license_plate: string;
  make?: string | null;
  model?: string | null;
  capacity: number;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TrackerRecord {
  id: string;
  tenant_id: string;
  branch_id: string;
  provider: string;
  provider_device_id: string;
  external_device_id?: string | null;
  battery_level: number;
  status: "ONLINE" | "OFFLINE" | "TAMPERED";
  last_seen_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TelemetryPacket {
  trackerId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  headingDegrees?: number;
  batteryLevel?: number;
  recordedAt: string | Date;
}

export interface ITrackerAdapter {
  providerName: string;
  getDeviceStatus(deviceId: string): Promise<{ isOnline: boolean; batteryLevel: number }>;
  normalizeTelemetry(rawPayload: any): TelemetryPacket;
}

/**
 * MockTrackerAdapter (ADR 0009 Section 3):
 * Provides deterministic IoT telemetry simulation for tests and dev environments.
 */
export class MockTrackerAdapter implements ITrackerAdapter {
  providerName = "MOCK";

  async getDeviceStatus(deviceId: string): Promise<{ isOnline: boolean; batteryLevel: number }> {
    return { isOnline: true, batteryLevel: 95 };
  }

  normalizeTelemetry(rawPayload: any): TelemetryPacket {
    return {
      trackerId: rawPayload.trackerId || rawPayload.device_id,
      latitude: Number(rawPayload.latitude),
      longitude: Number(rawPayload.longitude),
      speedKmh: rawPayload.speedKmh !== undefined ? Number(rawPayload.speedKmh) : 0,
      headingDegrees: rawPayload.headingDegrees !== undefined ? Number(rawPayload.headingDegrees) : 0,
      batteryLevel: rawPayload.batteryLevel !== undefined ? Number(rawPayload.batteryLevel) : 100,
      recordedAt: rawPayload.recordedAt || new Date(),
    };
  }
}

// Distance helper using Haversine formula (meters)
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class FleetService {
  private trackerAdapter: ITrackerAdapter = new MockTrackerAdapter();

  setTrackerAdapter(adapter: ITrackerAdapter) {
    this.trackerAdapter = adapter;
  }

  /**
   * List vehicles for a branch
   */
  async listVehicles(tenantId: string, branchId: string): Promise<VehicleRecord[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find(
        "vehicles",
        (v: any) => v.tenant_id === tenantId && v.branch_id === branchId
      );
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM vehicles WHERE tenant_id = $1 AND branch_id = $2 ORDER BY created_at DESC",
        [tenantId, branchId]
      );
      return res.rows;
    }
  }

  /**
   * Create a vehicle
   */
  async createVehicle(tenantId: string, branchId: string, params: {
    vehicleType: VehicleType;
    licensePlate: string;
    make?: string;
    model?: string;
    capacity?: number;
  }): Promise<VehicleRecord> {
    const vehicle: VehicleRecord = {
      id: `veh_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      branch_id: branchId,
      vehicle_type: params.vehicleType,
      license_plate: params.licensePlate,
      make: params.make || null,
      model: params.model || null,
      capacity: params.capacity || 4,
      status: "ACTIVE",
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("vehicles", vehicle);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO vehicles (
          id, tenant_id, branch_id, vehicle_type, license_plate, make, model, capacity, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          vehicle.id,
          vehicle.tenant_id,
          vehicle.branch_id,
          vehicle.vehicle_type,
          vehicle.license_plate,
          vehicle.make,
          vehicle.model,
          vehicle.capacity,
          vehicle.status,
        ]
      );
    }

    return vehicle;
  }

  /**
   * Assign Driver to Vehicle (Temporal Assignment - ADR 0009)
   */
  async assignDriverToVehicle(
    tenantId: string,
    driverUserId: string,
    vehicleId: string,
    assignedBy?: string
  ): Promise<any> {
    const now = new Date();

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      // Unassign existing active assignment for this driver or vehicle
      const existing = memoryDb.find(
        "driver_vehicle_assignments",
        (a: any) =>
          a.tenant_id === tenantId &&
          (a.driver_id === driverUserId || a.vehicle_id === vehicleId) &&
          a.unassigned_at === null
      );
      for (const e of existing) {
        memoryDb.update("driver_vehicle_assignments", e.id, { unassigned_at: now });
      }

      const assignment = {
        id: `dva_${crypto.randomUUID()}`,
        tenant_id: tenantId,
        driver_id: driverUserId,
        vehicle_id: vehicleId,
        assigned_at: now,
        unassigned_at: null,
        assigned_by: assignedBy || null,
      };
      memoryDb.insert("driver_vehicle_assignments", assignment);
      return assignment;
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE driver_vehicle_assignments SET unassigned_at = $1
         WHERE tenant_id = $2 AND (driver_id = $3 OR vehicle_id = $4) AND unassigned_at IS NULL`,
        [now, tenantId, driverUserId, vehicleId]
      );

      const id = `dva_${crypto.randomUUID()}`;
      const res = await pool.query(
        `INSERT INTO driver_vehicle_assignments (
          id, tenant_id, driver_id, vehicle_id, assigned_at, unassigned_at, assigned_by
        ) VALUES ($1, $2, $3, $4, $5, NULL, $6) RETURNING *`,
        [id, tenantId, driverUserId, vehicleId, now, assignedBy || null]
      );
      return res.rows[0];
    }
  }

  /**
   * Mount Tracker on Vehicle (Temporal Assignment - ADR 0009)
   */
  async assignTrackerToVehicle(
    tenantId: string,
    vehicleId: string,
    trackerId: string,
    assignedBy?: string
  ): Promise<any> {
    const now = new Date();

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const existing = memoryDb.find(
        "vehicle_tracker_assignments",
        (a: any) =>
          a.tenant_id === tenantId &&
          (a.vehicle_id === vehicleId || a.tracker_id === trackerId) &&
          a.unassigned_at === null
      );
      for (const e of existing) {
        memoryDb.update("vehicle_tracker_assignments", e.id, { unassigned_at: now });
      }

      const assignment = {
        id: `vta_${crypto.randomUUID()}`,
        tenant_id: tenantId,
        vehicle_id: vehicleId,
        tracker_id: trackerId,
        assigned_at: now,
        unassigned_at: null,
        assigned_by: assignedBy || null,
      };
      memoryDb.insert("vehicle_tracker_assignments", assignment);
      return assignment;
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE vehicle_tracker_assignments SET unassigned_at = $1
         WHERE tenant_id = $2 AND (vehicle_id = $3 OR tracker_id = $4) AND unassigned_at IS NULL`,
        [now, tenantId, vehicleId, trackerId]
      );

      const id = `vta_${crypto.randomUUID()}`;
      const res = await pool.query(
        `INSERT INTO vehicle_tracker_assignments (
          id, tenant_id, vehicle_id, tracker_id, assigned_at, unassigned_at, assigned_by
        ) VALUES ($1, $2, $3, $4, $5, NULL, $6) RETURNING *`,
        [id, tenantId, vehicleId, trackerId, now, assignedBy || null]
      );
      return res.rows[0];
    }
  }

  /**
   * Ingest Telemetry Packet & Evaluate Geofences (PHASE 00 Section 20-23 & ADR 0009)
   * CORE PRINCIPLE: Telemetry != Business Truth!
   * Proximity triggers ARRIVED_AT_CUSTOMER_AREA, but NEVER automatically marks DELIVERED.
   */
  async ingestTelemetry(tenantId: string, packet: TelemetryPacket): Promise<{
    locationId: string;
    vehicleId: string | null;
    geofenceTriggered: boolean;
    transitionedDeliveryId?: string;
  }> {
    const now = new Date();
    let vehicleId: string | null = null;

    // Resolve vehicle currently mounted with this tracker
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const activeMount = memoryDb.find(
        "vehicle_tracker_assignments",
        (a: any) =>
          a.tenant_id === tenantId &&
          a.tracker_id === packet.trackerId &&
          a.unassigned_at === null
      )[0];
      vehicleId = activeMount ? activeMount.vehicle_id : null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT vehicle_id FROM vehicle_tracker_assignments
         WHERE tenant_id = $1 AND tracker_id = $2 AND unassigned_at IS NULL LIMIT 1`,
        [tenantId, packet.trackerId]
      );
      vehicleId = res.rows[0]?.vehicle_id || null;
    }

    const locationRecord = {
      id: `loc_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      vehicle_id: vehicleId,
      tracker_id: packet.trackerId,
      latitude: packet.latitude,
      longitude: packet.longitude,
      speed_kmh: packet.speedKmh || 0,
      heading_degrees: packet.headingDegrees || 0,
      recorded_at: new Date(packet.recordedAt),
      received_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("vehicle_locations", locationRecord);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO vehicle_locations (
          id, tenant_id, vehicle_id, tracker_id, latitude, longitude, speed_kmh, heading_degrees, recorded_at, received_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          locationRecord.id,
          locationRecord.tenant_id,
          locationRecord.vehicle_id,
          locationRecord.tracker_id,
          locationRecord.latitude,
          locationRecord.longitude,
          locationRecord.speed_kmh,
          locationRecord.heading_degrees,
          locationRecord.recorded_at,
        ]
      );
    }

    // Geofence Evaluation:
    // Check active deliveries associated with this vehicle (or associated driver)
    let geofenceTriggered = false;
    let transitionedDeliveryId: string | undefined;

    if (vehicleId) {
      let activeDeliveries: any[] = [];
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        activeDeliveries = memoryDb.find(
          "deliveries",
          (d: any) =>
            d.tenant_id === tenantId &&
            d.vehicle_id === vehicleId &&
            d.status === "OUT_FOR_DELIVERY"
        );
      } else {
        const pool = getPostgresPool();
        const res = await pool.query(
          `SELECT * FROM deliveries
           WHERE tenant_id = $1 AND vehicle_id = $2 AND status = 'OUT_FOR_DELIVERY'`,
          [tenantId, vehicleId]
        );
        activeDeliveries = res.rows.map((row) => ({
          ...row,
          delivery_address:
            typeof row.delivery_address === "string" ? JSON.parse(row.delivery_address) : row.delivery_address,
        }));
      }

      for (const delivery of activeDeliveries) {
        const destLat = delivery.delivery_address?.latitude;
        const destLon = delivery.delivery_address?.longitude;

        if (destLat && destLon) {
          const distance = calculateDistanceMeters(
            packet.latitude,
            packet.longitude,
            destLat,
            destLon
          );

          // If vehicle is within 150 meters of destination, trigger ARRIVED_AT_CUSTOMER_AREA
          if (distance <= 150) {
            geofenceTriggered = true;
            transitionedDeliveryId = delivery.id;

            // Note: Advances to ARRIVED_AT_CUSTOMER_AREA, but NEVER to DELIVERED!
            await deliveryService.arriveDelivery(tenantId, delivery.id, delivery.driver_id);

            await auditLogger.log({
              actor: { actorId: packet.trackerId, actorType: "SYSTEM" },
              action: "VEHICLE_ENTERED_CUSTOMER_GEOFENCE",
              entity: "Delivery",
              entityId: delivery.id,
              metadata: {
                distanceMeters: Math.round(distance),
                newStatus: "ARRIVED_AT_CUSTOMER_AREA",
              },
            });
            break;
          }
        }
      }
    }

    return {
      locationId: locationRecord.id,
      vehicleId,
      geofenceTriggered,
      transitionedDeliveryId,
    };
  }
}

export const fleetService = new FleetService();
