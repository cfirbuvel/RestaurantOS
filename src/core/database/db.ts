import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

export interface DatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  release(): void;
}

export interface TenantContext {
  organizationId: string;
  branchId?: string;
  actorId?: string;
}

// In-Memory Database Fallback for Deterministic CI/Unit Testing
export class MemoryDatabase {
  public tables: Map<string, Map<string, any>> = new Map();
  public currentTenantId: string | null = null;
  public currentBranchId: string | null = null;

  constructor() {
    this.reset();
    if (process.env.NODE_ENV !== "test") {
      this.seedDevData();
    }
  }

  seedDevData() {
    const orgId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
    const restId = "770e8400-e29b-41d4-a716-446655440000";
    const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
    const userId = "c0ccd37f-a43a-4365-9093-d4158ee0f749";

    this.insert("organizations", {
      id: orgId,
      name: "Israeli Burgers",
      slug: "israeli-burgers",
      status: "ACTIVE",
      settings: { currency: "ILS", timezone: "Asia/Jerusalem" },
    });

    this.insert("restaurants", {
      id: restId,
      organization_id: orgId,
      name: "Israeli Burgers Main",
      slug: "israeli-burgers-main",
      status: "ACTIVE",
      brand_settings: {},
    });

    this.insert("branches", {
      id: branchId,
      organization_id: orgId,
      restaurant_id: restId,
      name: "סניף ראשי (Main Branch)",
      slug: "main",
      address: {},
      operational_settings: { currency: "ILS", timezone: "Asia/Jerusalem" },
      is_active: true,
    });

    this.insert("users", {
      id: userId,
      email: "owner@restotest.co.il",
      password_hash: bcrypt.hashSync("SecurePassword123!", 8),
      pin_code_hash: bcrypt.hashSync("4567", 8),
      first_name: "Israel",
      last_name: "Israeli",
      phone: "050-1234567",
      is_active: true,
      email_verified: true,
      pin_failed_attempts: 0,
    });

    this.insert("user_organizations", {
      user_id: userId,
      organization_id: orgId,
      role: "OWNER",
    });

    this.insert("user_branch_assignments", {
      user_id: userId,
      organization_id: orgId,
      restaurant_id: restId,
      branch_id: branchId,
      role: "OWNER",
      is_primary: true,
    });
  }

  reset() {
    this.tables.clear();
    const tableNames = [
      "organizations",
      "restaurants",
      "branches",
      "users",
      "user_organizations",
      "user_branch_assignments",
      "sessions",
      "audit_logs",
      "outbox_events",
      "feature_flags",
    ];
    for (const name of tableNames) {
      this.tables.set(name, new Map());
    }
    this.currentTenantId = null;
    this.currentBranchId = null;
  }

  setTenantContext(tenantId: string, branchId?: string) {
    this.currentTenantId = tenantId;
    this.currentBranchId = branchId || null;
  }

  clearTenantContext() {
    this.currentTenantId = null;
    this.currentBranchId = null;
  }

  getTable(tableName: string): Map<string, any> {
    let table = this.tables.get(tableName);
    if (!table) {
      table = new Map();
      this.tables.set(tableName, table);
    }
    return table;
  }

  insert(tableName: string, record: any): any {
    const table = this.getTable(tableName);
    const id = record.id || crypto.randomUUID();
    const item = {
      ...record,
      id,
      created_at: record.created_at || new Date(),
      updated_at: record.updated_at || new Date(),
    };
    table.set(id, item);
    return item;
  }

  findById(tableName: string, id: string): any | null {
    const table = this.getTable(tableName);
    const item = table.get(id);
    if (!item) return null;

    // Simulate RLS
    if (this.currentTenantId && item.organization_id && item.organization_id !== this.currentTenantId) {
      return null;
    }
    return item;
  }

  find(tableName: string, predicate: (record: any) => boolean): any[] {
    const table = this.getTable(tableName);
    const results: any[] = [];
    for (const item of table.values()) {
      // RLS Check
      if (this.currentTenantId && item.organization_id && item.organization_id !== this.currentTenantId) {
        continue;
      }
      if (predicate(item)) {
        results.push(item);
      }
    }
    return results;
  }

  update(tableName: string, id: string, updates: any): any | null {
    const table = this.getTable(tableName);
    const existing = this.findById(tableName, id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };
    table.set(id, updated);
    return updated;
  }

  delete(tableName: string, id: string): boolean {
    const table = this.getTable(tableName);
    const existing = this.findById(tableName, id);
    if (!existing) return false;
    return table.delete(id);
  }
}

// Global in-memory DB singleton preserved across Next.js dev reloads
const globalForDb = globalThis as unknown as {
  memoryDb: MemoryDatabase | undefined;
};

if (!globalForDb.memoryDb || typeof (globalForDb.memoryDb as any).seedDevData !== "function") {
  globalForDb.memoryDb = new MemoryDatabase();
}

export const memoryDb = globalForDb.memoryDb;

if (process.env.NODE_ENV !== "production") {
  if (!memoryDb.findById("users", "c0ccd37f-a43a-4365-9093-d4158ee0f749")) {
    memoryDb.seedDevData();
  }
}

// Live Postgres Pool
let pool: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString: connectionString || "postgresql://postgres:postgres@localhost:5432/restaurant_os",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export async function withTenantContext<T>(
  tenant: TenantContext,
  operation: (db: { memory: MemoryDatabase; client?: pg.PoolClient }) => Promise<T>
): Promise<T> {
  // If running in test mode or no live DATABASE_URL is configured, use deterministic MemoryDatabase
  if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
    memoryDb.setTenantContext(tenant.organizationId, tenant.branchId);
    try {
      return await operation({ memory: memoryDb });
    } finally {
      memoryDb.clearTenantContext();
    }
  }

  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL app.current_tenant_id = $1", [tenant.organizationId]);
    if (tenant.branchId) {
      await client.query("SET LOCAL app.current_branch_id = $1", [tenant.branchId]);
    }
    const result = await operation({ memory: memoryDb, client });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
