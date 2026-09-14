import { z } from "zod";

export interface Customer {
  id: string;
  tenant_id: string;
  phone: string;
  email?: string | null;
  first_name: string;
  last_name: string;
  birthdate?: string | null;
  is_vip: boolean;
  total_orders_count: number;
  total_spent_amount: number;
  average_order_value: number;
  last_order_at?: Date | string | null;
  internal_notes?: string | null;
  allergies: string[];
  preferences: Record<string, any>;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
  version: number;
}

export interface CustomerAddress {
  id: string;
  tenant_id: string;
  customer_id: string;
  street: string;
  house_number: string;
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
  city: string;
  postal_code?: string | null;
  gate_code?: string | null;
  parking_instructions?: string | null;
  delivery_notes?: string | null;
  location?: { lat: number; lng: number } | null;
  is_default: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
  version: number;
}

/**
 * Data Minimization for Delivery (Phase 0 Section 31):
 * Couriers receive only operational delivery details — ZERO exposure to
 * full CRM order history, lifetime value, total spend, internal notes, or birthdate.
 */
export interface DeliveryViewDTO {
  customerDisplayName: string;
  contactPhoneMasked: string;
  deliveryAddress: {
    street: string;
    houseNumber: string;
    entrance?: string | null;
    floor?: string | null;
    apartment?: string | null;
    city: string;
    postalCode?: string | null;
    location?: { lat: number; lng: number } | null;
  };
  accessInstructions: {
    gateCode?: string | null;
    parkingInstructions?: string | null;
  };
  deliveryNotes?: string | null;
}

export function toDeliveryViewDTO(
  customer: Customer,
  address?: CustomerAddress | null
): DeliveryViewDTO {
  // Mask phone e.g. 050-***4567
  const rawPhone = customer.phone || "";
  const maskedPhone =
    rawPhone.length > 4
      ? rawPhone.slice(0, 3) + "-***" + rawPhone.slice(-4)
      : "***";

  return {
    customerDisplayName: `${customer.first_name} ${customer.last_name}`.trim(),
    contactPhoneMasked: maskedPhone,
    deliveryAddress: address
      ? {
          street: address.street,
          houseNumber: address.house_number,
          entrance: address.entrance,
          floor: address.floor,
          apartment: address.apartment,
          city: address.city,
          postalCode: address.postal_code,
          location: address.location,
        }
      : {
          street: "איסוף עצמי / לא צוין",
          houseNumber: "",
          city: "",
        },
    accessInstructions: {
      gateCode: address?.gate_code || null,
      parkingInstructions: address?.parking_instructions || null,
    },
    deliveryNotes: address?.delivery_notes || null,
  };
}

export const createCustomerSchema = z.object({
  phone: z.string().min(7, "Valid phone number required"),
  email: z.string().email().optional().or(z.literal("")),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  birthdate: z.string().optional(),
  internalNotes: z.string().optional(),
  allergies: z.array(z.string()).default([]),
  preferences: z.record(z.any()).default({}),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const createAddressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  houseNumber: z.string().min(1, "House number is required"),
  entrance: z.string().optional(),
  floor: z.string().optional(),
  apartment: z.string().optional(),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().optional(),
  gateCode: z.string().optional(),
  parkingInstructions: z.string().optional(),
  deliveryNotes: z.string().optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  isDefault: z.boolean().default(false),
});
