import { memoryDb, getPostgresPool } from "@/core/database/db";

export interface OperationalSettings {
  currency: string;
  timezone: string;
  taxRate: number;
  prepTimeMinutes: number;
  autoAcceptOrders?: boolean;
  deliveryRadiusKm?: number;
  [key: string]: any;
}

export interface Restaurant {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE";
  brandSettings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Branch {
  id: string;
  organizationId: string;
  restaurantId: string;
  name: string;
  slug: string;
  address: Record<string, any>;
  phone?: string;
  operationalSettings: OperationalSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BranchService {
  async createRestaurant(input: {
    organizationId: string;
    name: string;
    slug: string;
    brandSettings?: Record<string, any>;
  }): Promise<Restaurant> {
    const slug = input.slug.toLowerCase().trim();

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const existing = memoryDb.find(
        "restaurants",
        (r) => r.organization_id === input.organizationId && r.slug === slug
      );
      if (existing.length > 0) {
        throw new Error(`Restaurant slug '${slug}' already exists in this organization`);
      }

      const raw = memoryDb.insert("restaurants", {
        organization_id: input.organizationId,
        name: input.name,
        slug,
        status: "ACTIVE",
        brand_settings: input.brandSettings || {},
      });

      return this.mapRestaurantToDomain(raw);
    }

    const pool = getPostgresPool();
    const { rows } = await pool.query(
      `INSERT INTO restaurants (organization_id, name, slug, status, brand_settings)
       VALUES ($1, $2, $3, 'ACTIVE', $4)
       RETURNING *`,
      [input.organizationId, input.name, slug, JSON.stringify(input.brandSettings || {})]
    );

    return this.mapRestaurantToDomain(rows[0]);
  }

  async createBranch(input: {
    organizationId: string;
    restaurantId: string;
    name: string;
    slug: string;
    address?: Record<string, any>;
    phone?: string;
    operationalSettings?: Partial<OperationalSettings>;
  }): Promise<Branch> {
    const slug = input.slug.toLowerCase().trim();
    const settings: OperationalSettings = {
      currency: "ILS",
      timezone: "Asia/Jerusalem",
      taxRate: 0.17,
      prepTimeMinutes: 20,
      autoAcceptOrders: false,
      deliveryRadiusKm: 5,
      ...input.operationalSettings,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const existing = memoryDb.find(
        "branches",
        (b) => b.restaurant_id === input.restaurantId && b.slug === slug
      );
      if (existing.length > 0) {
        throw new Error(`Branch slug '${slug}' already exists in this restaurant`);
      }

      const raw = memoryDb.insert("branches", {
        organization_id: input.organizationId,
        restaurant_id: input.restaurantId,
        name: input.name,
        slug,
        address: input.address || {},
        phone: input.phone || null,
        operational_settings: settings,
        is_active: true,
      });

      return this.mapBranchToDomain(raw);
    }

    const pool = getPostgresPool();
    const { rows } = await pool.query(
      `INSERT INTO branches (organization_id, restaurant_id, name, slug, address, phone, operational_settings, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [
        input.organizationId,
        input.restaurantId,
        input.name,
        slug,
        JSON.stringify(input.address || {}),
        input.phone || null,
        JSON.stringify(settings),
      ]
    );

    return this.mapBranchToDomain(rows[0]);
  }

  async findBranchById(organizationId: string, branchId: string): Promise<Branch | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const raw = memoryDb.findById("branches", branchId);
      if (!raw || raw.organization_id !== organizationId) return null;
      return this.mapBranchToDomain(raw);
    }

    const pool = getPostgresPool();
    const { rows } = await pool.query(
      `SELECT * FROM branches WHERE id = $1 AND organization_id = $2`,
      [branchId, organizationId]
    );
    return rows.length > 0 ? this.mapBranchToDomain(rows[0]) : null;
  }

  async listBranches(organizationId: string, restaurantId?: string): Promise<Branch[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const rows = memoryDb.find(
        "branches",
        (b) => b.organization_id === organizationId && (!restaurantId || b.restaurant_id === restaurantId)
      );
      return rows.map((r) => this.mapBranchToDomain(r));
    }

    const pool = getPostgresPool();
    let query = `SELECT * FROM branches WHERE organization_id = $1`;
    const params: any[] = [organizationId];
    if (restaurantId) {
      query += ` AND restaurant_id = $2`;
      params.push(restaurantId);
    }
    query += ` ORDER BY name ASC`;
    const { rows } = await pool.query(query, params);
    return rows.map((r) => this.mapBranchToDomain(r));
  }

  private mapRestaurantToDomain(row: any): Restaurant {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      brandSettings: typeof row.brand_settings === "string" ? JSON.parse(row.brand_settings) : row.brand_settings,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapBranchToDomain(row: any): Branch {
    return {
      id: row.id,
      organizationId: row.organization_id,
      restaurantId: row.restaurant_id,
      name: row.name,
      slug: row.slug,
      address: typeof row.address === "string" ? JSON.parse(row.address) : row.address,
      phone: row.phone,
      operationalSettings:
        typeof row.operational_settings === "string"
          ? JSON.parse(row.operational_settings)
          : row.operational_settings,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export const branchService = new BranchService();
