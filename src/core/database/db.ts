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

    // ── Phase 2 Seed Data: CRM ──
    const customerId = "cust-01-israel-israeli";
    this.insert("customers", {
      id: customerId,
      tenant_id: orgId,
      phone: "054-9876543",
      email: "customer@israeliburger.co.il",
      first_name: "דני",
      last_name: "כהן",
      birthdate: "1990-05-15",
      is_vip: true,
      total_orders_count: 5,
      total_spent_amount: 420.0,
      average_order_value: 84.0,
      last_order_at: new Date(),
      internal_notes: "לקוח VIP קבוע - להוסיף רטבים בחינם",
      allergies: ["בוטנים"],
      preferences: { spicy: "בינוני", preferred_channel: "WEB" },
    });

    const addressId = "addr-01-dani-home";
    this.insert("customer_addresses", {
      id: addressId,
      tenant_id: orgId,
      customer_id: customerId,
      street: "רוטשילד",
      house_number: "45",
      entrance: "ב",
      floor: "3",
      apartment: "12",
      city: "תל אביב",
      postal_code: "6512301",
      gate_code: "1357#",
      parking_instructions: "חניה בחניון הבניין משמאל",
      delivery_notes: "נא לא לצלצל בפעמון, תינוק ישן - להשאיר ליד הדלת",
      is_default: true,
    });

    // ── Phase 2 Seed Data: Menu ──
    const catBurgersId = "cat-01-burgers";
    const catSidesId = "cat-02-sides";
    const catDrinksId = "cat-03-drinks";

    this.insert("menu_categories", {
      id: catBurgersId,
      tenant_id: orgId,
      name: "המבורגרים (Burgers)",
      slug: "burgers",
      description: "המבורגרים מבשר בקר איכותי 100%",
      sort_order: 1,
      is_active: true,
    });

    this.insert("menu_categories", {
      id: catSidesId,
      tenant_id: orgId,
      name: "תוספות (Sides)",
      slug: "sides",
      description: "תוספות חמות ופריכות",
      sort_order: 2,
      is_active: true,
    });

    this.insert("menu_categories", {
      id: catDrinksId,
      tenant_id: orgId,
      name: "שתייה (Drinks)",
      slug: "drinks",
      description: "משקאות קלים ומרעננים",
      sort_order: 3,
      is_active: true,
    });

    // Modifier Groups
    const modDonenessId = "mg-01-doneness";
    this.insert("modifier_groups", {
      id: modDonenessId,
      tenant_id: orgId,
      name: "מידת עשייה",
      min_selection: 1,
      max_selection: 1,
      is_required: true,
    });

    this.insert("modifiers", {
      id: "mod-m",
      modifier_group_id: modDonenessId,
      name: "M (מדיום)",
      price_adjustment: 0.0,
      is_active: true,
    });
    this.insert("modifiers", {
      id: "mod-mw",
      modifier_group_id: modDonenessId,
      name: "MW (מדיום וול)",
      price_adjustment: 0.0,
      is_active: true,
    });
    this.insert("modifiers", {
      id: "mod-wd",
      modifier_group_id: modDonenessId,
      name: "WD (וול דאן)",
      price_adjustment: 0.0,
      is_active: true,
    });

    const modToppingsId = "mg-02-toppings";
    this.insert("modifier_groups", {
      id: modToppingsId,
      tenant_id: orgId,
      name: "תוספות להמבורגר",
      min_selection: 0,
      max_selection: 4,
      is_required: false,
    });

    this.insert("modifiers", {
      id: "mod-cheddar",
      modifier_group_id: modToppingsId,
      name: "צ'דר טבעוני / רגיל",
      price_adjustment: 8.0,
      is_active: true,
    });
    this.insert("modifiers", {
      id: "mod-onion",
      modifier_group_id: modToppingsId,
      name: "בצל מקורמל",
      price_adjustment: 6.0,
      is_active: true,
    });
    this.insert("modifiers", {
      id: "mod-egg",
      modifier_group_id: modToppingsId,
      name: "ביצת עין",
      price_adjustment: 7.0,
      is_active: true,
    });

    // Products
    const prodClassicId = "prod-01-classic-burger";
    this.insert("products", {
      id: prodClassicId,
      tenant_id: orgId,
      category_id: catBurgersId,
      name: "המבורגר קלאסי 220 גרם",
      description: "חסה, עגבניה, בצל סגול, מלפפון חמוץ ורוטב הבית",
      base_price: 58.0,
      currency: "ILS",
      sku: "BGR-CLS-220",
      image_url: "/images/burger-classic.jpg",
      is_active: true,
      tax_rate: 0.17,
      modifier_group_ids: [modDonenessId, modToppingsId],
    });

    this.insert("product_variants", {
      id: "var-01-double",
      product_id: prodClassicId,
      name: "דאבל (440 גרם)",
      price_adjustment: 24.0,
      sku: "BGR-CLS-440",
      is_active: true,
    });

    const prodFriesId = "prod-02-fries";
    this.insert("products", {
      id: prodFriesId,
      tenant_id: orgId,
      category_id: catSidesId,
      name: "צ'יפס בלגי פריך",
      description: "צ'יפס הולנדי עבה מתובל במלח ים",
      base_price: 22.0,
      currency: "ILS",
      sku: "SIDE-FRS-01",
      image_url: "/images/fries.jpg",
      is_active: true,
      tax_rate: 0.17,
      modifier_group_ids: [],
    });

    const prodColaId = "prod-03-coke";
    this.insert("products", {
      id: prodColaId,
      tenant_id: orgId,
      category_id: catDrinksId,
      name: "קוקה קולה 330 מ\"ל",
      description: "בקבוק זכוכית קר",
      base_price: 12.0,
      currency: "ILS",
      sku: "DRK-COKE-330",
      image_url: "/images/coke.jpg",
      is_active: true,
      tax_rate: 0.17,
      modifier_group_ids: [],
    });

    // ── Phase 2 Seed Data: Sample Initial Order ──
    const seedOrderId = "ord-01-seed-sample";
    this.insert("orders", {
      id: seedOrderId,
      tenant_id: orgId,
      branch_id: branchId,
      customer_id: customerId,
      order_number: "ORD-1001",
      channel: "WEB",
      order_type: "DELIVERY",
      status: "CONFIRMED",
      payment_status: "PAID",
      subtotal: 92.0,
      tax_amount: 15.64,
      discount_amount: 0.0,
      delivery_fee: 15.0,
      tip_amount: 10.0,
      total_amount: 117.0,
      currency: "ILS",
      notes: "נא לצרף הרבה מפיות",
      kitchen_notes: "מידת עשייה MW",
      delivery_address_id: addressId,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    this.insert("order_items", {
      id: "oi-01",
      order_id: seedOrderId,
      product_id: prodClassicId,
      variant_id: null,
      name: "המבורגר קלאסי 220 גרם",
      quantity: 1,
      unit_price: 58.0,
      total_price: 66.0,
      notes: "ללא בצל",
      selected_modifiers: [
        { modifier_id: "mod-mw", name: "MW (מדיום וול)", price: 0.0 },
        { modifier_id: "mod-cheddar", name: "צ'דר טבעוני / רגיל", price: 8.0 },
      ],
    });

    this.insert("order_items", {
      id: "oi-02",
      order_id: seedOrderId,
      product_id: prodFriesId,
      variant_id: null,
      name: "צ'יפס בלגי פריך",
      quantity: 1,
      unit_price: 22.0,
      total_price: 22.0,
      notes: "",
      selected_modifiers: [],
    });

    this.insert("order_items", {
      id: "oi-03",
      order_id: seedOrderId,
      product_id: prodColaId,
      variant_id: null,
      name: "קוקה קולה 330 מ\"ל",
      quantity: 1,
      unit_price: 12.0,
      total_price: 12.0,
      notes: "",
      selected_modifiers: [],
    });

    // ── Phase 3 Seed Data: KDS Stations & Routing ──
    const stationBurgersId = "st-01-burgers";
    const stationSidesId = "st-02-sides";
    const stationDrinksId = "st-03-drinks";

    this.insert("kds_stations", {
      id: stationBurgersId,
      tenant_id: orgId,
      branch_id: branchId,
      name: "burgers",
      display_name: "עמדת המבורגרים (Burgers)",
      station_type: "KITCHEN",
      is_active: true,
    });

    this.insert("kds_stations", {
      id: stationSidesId,
      tenant_id: orgId,
      branch_id: branchId,
      name: "sides",
      display_name: "עמדת צ'יפס ותוספות (Sides)",
      station_type: "KITCHEN",
      is_active: true,
    });

    this.insert("kds_stations", {
      id: stationDrinksId,
      tenant_id: orgId,
      branch_id: branchId,
      name: "drinks",
      display_name: "עמדת שתייה (Drinks)",
      station_type: "EXPO",
      is_active: true,
    });

    // Product to Station Assignments
    this.insert("product_station_assignments", {
      id: "psa-01",
      tenant_id: orgId,
      branch_id: branchId,
      station_id: stationBurgersId,
      product_id: prodClassicId,
      category_id: catBurgersId,
    });

    this.insert("product_station_assignments", {
      id: "psa-02",
      tenant_id: orgId,
      branch_id: branchId,
      station_id: stationSidesId,
      product_id: prodFriesId,
      category_id: catSidesId,
    });

    this.insert("product_station_assignments", {
      id: "psa-03",
      tenant_id: orgId,
      branch_id: branchId,
      station_id: stationDrinksId,
      product_id: prodColaId,
      category_id: catDrinksId,
    });

    // Seeded KDS tickets for seed sample order (ord-01-seed-sample)
    const tktBurgerId = "kds-tkt-01-burgers";
    this.insert("kds_tickets", {
      id: tktBurgerId,
      tenant_id: orgId,
      branch_id: branchId,
      station_id: stationBurgersId,
      order_id: seedOrderId,
      order_number: "ORD-1001",
      status: "QUEUED",
      priority: "NORMAL",
      started_at: null,
      ready_at: null,
      completed_at: null,
      recalled_at: null,
      cook_id: null,
      created_at: new Date(),
    });

    this.insert("kds_ticket_items", {
      id: "kti-01",
      tenant_id: orgId,
      ticket_id: tktBurgerId,
      order_item_id: "oi-01",
      product_id: prodClassicId,
      name: "המבורגר קלאסי 220 גרם",
      quantity: 1,
      notes: "ללא בצל",
      selected_modifiers: [
        { modifier_id: "mod-mw", name: "MW (מדיום וול)", price: 0.0 },
        { modifier_id: "mod-cheddar", name: "צ'דר טבעוני / רגיל", price: 8.0 },
      ],
      status: "PENDING",
    });

    const tktSidesId = "kds-tkt-02-sides";
    this.insert("kds_tickets", {
      id: tktSidesId,
      tenant_id: orgId,
      branch_id: branchId,
      station_id: stationSidesId,
      order_id: seedOrderId,
      order_number: "ORD-1001",
      status: "QUEUED",
      priority: "NORMAL",
      started_at: null,
      ready_at: null,
      completed_at: null,
      recalled_at: null,
      cook_id: null,
      created_at: new Date(),
    });

    this.insert("kds_ticket_items", {
      id: "kti-02",
      tenant_id: orgId,
      ticket_id: tktSidesId,
      order_item_id: "oi-02",
      product_id: prodFriesId,
      name: "צ'יפס בלגי פריך",
      quantity: 1,
      notes: "",
      selected_modifiers: [],
      status: "PENDING",
    });

    const tktDrinksId = "kds-tkt-03-drinks";
    this.insert("kds_tickets", {
      id: tktDrinksId,
      tenant_id: orgId,
      branch_id: branchId,
      station_id: stationDrinksId,
      order_id: seedOrderId,
      order_number: "ORD-1001",
      status: "QUEUED",
      priority: "NORMAL",
      started_at: null,
      ready_at: null,
      completed_at: null,
      recalled_at: null,
      cook_id: null,
      created_at: new Date(),
    });

    this.insert("kds_ticket_items", {
      id: "kti-03",
      tenant_id: orgId,
      ticket_id: tktDrinksId,
      order_item_id: "oi-03",
      product_id: prodColaId,
      name: "קוקה קולה 330 מ\"ל",
      quantity: 1,
      notes: "",
      selected_modifiers: [],
      status: "PENDING",
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
      "customers",
      "customer_addresses",
      "menu_categories",
      "products",
      "product_variants",
      "modifier_groups",
      "modifiers",
      "branch_product_availability",
      "orders",
      "order_items",
      "kds_stations",
      "kds_tickets",
      "kds_ticket_items",
      "product_station_assignments",
      "realtime_tickets",
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
    if (this.currentTenantId && item.tenant_id && item.tenant_id !== this.currentTenantId) {
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
      if (this.currentTenantId && item.tenant_id && item.tenant_id !== this.currentTenantId) {
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
const DB_SCHEMA_VERSION = 3;

const globalForDb = globalThis as unknown as {
  memoryDb: MemoryDatabase | undefined;
  dbSchemaVersion: number | undefined;
};

if (
  !globalForDb.memoryDb ||
  globalForDb.dbSchemaVersion !== DB_SCHEMA_VERSION ||
  !globalForDb.memoryDb.getTable("kds_stations")?.has("st-01-burgers")
) {
  globalForDb.memoryDb = new MemoryDatabase();
  globalForDb.dbSchemaVersion = DB_SCHEMA_VERSION;
} else {
  Object.setPrototypeOf(globalForDb.memoryDb, MemoryDatabase.prototype);
}

export const memoryDb = globalForDb.memoryDb;

if (process.env.NODE_ENV !== "production") {
  if (
    !memoryDb.findById("users", "c0ccd37f-a43a-4365-9093-d4158ee0f749") ||
    !memoryDb.findById("customers", "cust-01-israel-israeli") ||
    !memoryDb.findById("products", "prod-01-classic-burger") ||
    !memoryDb.findById("kds_stations", "st-01-burgers")
  ) {
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
