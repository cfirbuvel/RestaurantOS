import { memoryDb, getPostgresPool } from "@/core/database/db";

export interface OrganizationSettings {
  defaultCurrency?: string;
  defaultTimezone?: string;
  defaultLanguage?: string;
  taxNumber?: string;
  legalEntityName?: string;
  [key: string]: any;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  settings: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export class OrganizationService {
  async createOrganization(input: {
    name: string;
    slug: string;
    settings?: OrganizationSettings;
  }): Promise<Organization> {
    const slug = input.slug.toLowerCase().trim();

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const existing = memoryDb.find("organizations", (org) => org.slug === slug);
      if (existing.length > 0) {
        throw new Error(`Organization slug '${slug}' already exists`);
      }

      const raw = memoryDb.insert("organizations", {
        name: input.name,
        slug,
        status: "ACTIVE",
        settings: input.settings || {
          defaultCurrency: "ILS",
          defaultTimezone: "Asia/Jerusalem",
          defaultLanguage: "he",
        },
      });

      return this.mapToDomain(raw);
    }

    const pool = getPostgresPool();
    const { rows } = await pool.query(
      `INSERT INTO organizations (name, slug, status, settings)
       VALUES ($1, $2, 'ACTIVE', $3)
       RETURNING *`,
      [
        input.name,
        slug,
        JSON.stringify(input.settings || {
          defaultCurrency: "ILS",
          defaultTimezone: "Asia/Jerusalem",
          defaultLanguage: "he",
        }),
      ]
    );

    return this.mapToDomain(rows[0]);
  }

  async findById(id: string): Promise<Organization | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const raw = memoryDb.findById("organizations", id);
      return raw ? this.mapToDomain(raw) : null;
    }

    const pool = getPostgresPool();
    const { rows } = await pool.query(`SELECT * FROM organizations WHERE id = $1`, [id]);
    return rows.length > 0 ? this.mapToDomain(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const cleanSlug = slug.toLowerCase().trim();
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const raw = memoryDb.find("organizations", (org) => org.slug === cleanSlug);
      return raw.length > 0 ? this.mapToDomain(raw[0]) : null;
    }

    const pool = getPostgresPool();
    const { rows } = await pool.query(`SELECT * FROM organizations WHERE slug = $1`, [cleanSlug]);
    return rows.length > 0 ? this.mapToDomain(rows[0]) : null;
  }

  private mapToDomain(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      settings: typeof row.settings === "string" ? JSON.parse(row.settings) : row.settings,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export const organizationService = new OrganizationService();
