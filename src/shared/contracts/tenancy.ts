/**
 * Canonical Tenancy & Organizational Hierarchy Contracts
 *
 * Hierarchy:
 * Organization (Tenant) -> Restaurant -> Branch -> Station/Device
 */

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "TRIAL";
  createdAt: string;
}

export interface RestaurantSummary {
  id: string;
  organizationId: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
}

export interface BranchSummary {
  id: string;
  restaurantId: string;
  organizationId: string;
  name: string;
  code: string;
  address?: {
    street: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    location?: { lat: number; lng: number };
  };
  phone?: string;
  isActive: boolean;
}

export interface StationSummary {
  id: string;
  branchId: string;
  name: string;
  type: "GRILL" | "SALAD" | "FRYER" | "PIZZA" | "EXPO" | "BAR" | "DISH";
  isActive: boolean;
}

export interface TenancyScope {
  tenantId: string;
  restaurantId?: string;
  branchId?: string;
  stationId?: string;
}
