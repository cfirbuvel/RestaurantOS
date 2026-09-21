/**
 * Canonical Fleet & Vehicle Telematics Contracts
 */

import { VehicleType } from "@/modules/delivery/domain/delivery";
import { VehicleRecord, TrackerRecord, TelemetryPacket } from "@/modules/fleet/services/fleet-service";

export type { VehicleType, VehicleRecord, TrackerRecord, TelemetryPacket };

export interface VehicleSummaryDTO {
  id: string;
  vehicleType: VehicleType;
  licensePlate: string;
  make?: string | null;
  model?: string | null;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  currentDriverId?: string | null;
  currentTrackerId?: string | null;
  lastLocation?: {
    lat: number;
    lng: number;
    recordedAt: string;
    speedKmh?: number;
    batteryLevel?: number;
  };
}

export interface DriverVehicleAssignmentPayload {
  driverId: string;
  vehicleId: string;
}

export interface VehicleTrackerAssignmentPayload {
  vehicleId: string;
  trackerId: string;
}
