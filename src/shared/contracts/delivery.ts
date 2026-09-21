/**
 * Canonical Delivery Logistics & Driver Minimization Contracts
 */

import {
  DeliveryStatus,
  DELIVERY_STATUSES,
  ShiftStatus,
  AssignmentStatus,
  TripStatus,
  VehicleType,
  BatchStatus,
  DeliveryAddress,
  Delivery,
} from "@/modules/delivery/domain/delivery";

export type {
  DeliveryStatus,
  ShiftStatus,
  AssignmentStatus,
  TripStatus,
  VehicleType,
  BatchStatus,
  DeliveryAddress,
  Delivery,
};

export { DELIVERY_STATUSES };

/**
 * Driver Least-Privilege Data Minimization View DTO (DOC-SEC-ARCH-001)
 *
 * CRITICAL PRIVACY & SECURITY INVARIANT:
 * Drivers MUST NEVER receive full customer CRM history, kitchen preparation records,
 * internal cost margins, supplier data, or details of other drivers.
 * Customer phone numbers must be masked/relayed through the telephony proxy.
 */
export interface DeliveryViewDTO {
  deliveryId: string;
  orderNumber: string;
  destination: {
    street: string;
    houseNumber: string;
    entrance?: string;
    floor?: string;
    apartment?: string;
    gateCode?: string;
    parkingInstructions?: string;
    deliveryNotes?: string;
    location: { lat: number; lng: number };
  };
  customerContact: {
    displayName: string;
    maskedPhone: string; // e.g. "+972-3-***-1234 (Ext 88)" or proxied
  };
  deliveryStatus: DeliveryStatus;
  itemsSummary: Array<{
    name: string;
    quantity: number;
  }>;
  isPaid: boolean;
  amountToCollectOnDelivery: number; // 0.00 if already paid online
  assignedAt?: string;
  estimatedArrival?: string;
}

export interface DriverQueueItemDTO {
  driverId: string;
  driverName: string;
  shiftStatus: ShiftStatus;
  assignmentStatus: AssignmentStatus;
  tripStatus: TripStatus;
  availableSince: string; // ISO 8601 for FIFO sorting
  currentDeliveryId?: string | null;
  assignedVehicleId?: string | null;
}

export interface DriverShiftUpdatePayload {
  action: "CLOCK_IN" | "CLOCK_OUT" | "START_BREAK" | "END_BREAK" | "ARRIVED_AT_RESTAURANT";
  vehicleId?: string;
}
