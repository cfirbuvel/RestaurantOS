import pg from "pg";

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

export const memoryDb = globalForDb.memoryDb ?? new MemoryDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.memoryDb = memoryDb;
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
