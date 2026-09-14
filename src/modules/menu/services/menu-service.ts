import { memoryDb, getPostgresPool } from "@/core/database/db";
import {
  MenuCategory,
  Product,
  ProductVariant,
  ModifierGroup,
  Modifier,
  BranchProductAvailability,
} from "../domain/menu";

export class MenuService {
  // ── Categories ────────────────────────────────────────────────────────────

  async listCategories(tenantId: string): Promise<MenuCategory[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const cats = memoryDb.find(
        "menu_categories",
        (c: any) => c.tenant_id === tenantId && !c.deleted_at
      );
      return cats.sort((a: any, b: any) => a.sort_order - b.sort_order) as MenuCategory[];
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      "SELECT * FROM menu_categories WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC",
      [tenantId]
    );
    return res.rows as MenuCategory[];
  }

  async createCategory(
    tenantId: string,
    input: { name: string; slug?: string; description?: string; sortOrder?: number; isActive?: boolean }
  ): Promise<MenuCategory> {
    const slug = input.slug || input.name.toLowerCase().replace(/[^a-z0-9א-ת]/g, "-");
    const record: Partial<MenuCategory> = {
      tenant_id: tenantId,
      name: input.name.trim(),
      slug,
      description: input.description || null,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.insert("menu_categories", record) as MenuCategory;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      `INSERT INTO menu_categories (tenant_id, name, slug, description, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, record.name, record.slug, record.description, record.sort_order, record.is_active]
    );
    return res.rows[0] as MenuCategory;
  }

  // ── Modifier Groups ───────────────────────────────────────────────────────

  async createModifierGroup(
    tenantId: string,
    input: {
      name: string;
      minSelection: number;
      maxSelection: number;
      isRequired: boolean;
      modifiers: Array<{ name: string; priceAdjustment: number }>;
    }
  ): Promise<ModifierGroup> {
    const groupRecord: Partial<ModifierGroup> = {
      tenant_id: tenantId,
      name: input.name.trim(),
      min_selection: input.minSelection,
      max_selection: input.maxSelection,
      is_required: input.isRequired,
    };

    let group: ModifierGroup;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      group = memoryDb.insert("modifier_groups", groupRecord) as ModifierGroup;
      const createdModifiers: Modifier[] = [];
      for (const m of input.modifiers) {
        const mod = memoryDb.insert("modifiers", {
          modifier_group_id: group.id,
          name: m.name.trim(),
          price_adjustment: m.priceAdjustment,
          is_active: true,
        });
        createdModifiers.push(mod as Modifier);
      }
      group.modifiers = createdModifiers;
      return group;
    }

    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const groupRes = await client.query(
        `INSERT INTO modifier_groups (tenant_id, name, min_selection, max_selection, is_required)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenantId, groupRecord.name, groupRecord.min_selection, groupRecord.max_selection, groupRecord.is_required]
      );
      group = groupRes.rows[0] as ModifierGroup;

      const createdModifiers: Modifier[] = [];
      for (const m of input.modifiers) {
        const modRes = await client.query(
          `INSERT INTO modifiers (modifier_group_id, name, price_adjustment, is_active)
           VALUES ($1, $2, $3, true) RETURNING *`,
          [group.id, m.name.trim(), m.priceAdjustment]
        );
        createdModifiers.push(modRes.rows[0] as Modifier);
      }
      await client.query("COMMIT");
      group.modifiers = createdModifiers;
      return group;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getModifierGroup(tenantId: string, groupId: string): Promise<ModifierGroup | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const groups = memoryDb.find("modifier_groups", (g: any) => g.id === groupId && g.tenant_id === tenantId);
      if (groups.length === 0) return null;
      const group = { ...groups[0] } as ModifierGroup;
      group.modifiers = memoryDb.find(
        "modifiers",
        (m: any) => m.modifier_group_id === groupId && m.is_active
      ) as Modifier[];
      return group;
    }

    const pool = getPostgresPool();
    const gRes = await pool.query(
      "SELECT * FROM modifier_groups WHERE id = $1 AND tenant_id = $2",
      [groupId, tenantId]
    );
    if (gRes.rows.length === 0) return null;
    const group = gRes.rows[0] as ModifierGroup;
    const mRes = await pool.query(
      "SELECT * FROM modifiers WHERE modifier_group_id = $1 AND is_active = true",
      [groupId]
    );
    group.modifiers = mRes.rows as Modifier[];
    return group;
  }

  // ── Products ──────────────────────────────────────────────────────────────

  async createProduct(
    tenantId: string,
    input: {
      categoryId: string;
      name: string;
      description?: string;
      basePrice: number;
      currency?: string;
      sku?: string;
      imageUrl?: string;
      isActive?: boolean;
      taxRate?: number;
      modifierGroupIds?: string[];
      variants?: Array<{ name: string; priceAdjustment: number; sku?: string }>;
    }
  ): Promise<Product> {
    const productRecord: Partial<Product> = {
      tenant_id: tenantId,
      category_id: input.categoryId,
      name: input.name.trim(),
      description: input.description || null,
      base_price: input.basePrice,
      currency: input.currency || "ILS",
      sku: input.sku || null,
      image_url: input.imageUrl || null,
      is_active: input.isActive ?? true,
      tax_rate: input.taxRate ?? 0.17,
      modifier_group_ids: input.modifierGroupIds || [],
    };

    let product: Product;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      product = memoryDb.insert("products", productRecord) as Product;
      const createdVariants: ProductVariant[] = [];
      if (input.variants && input.variants.length > 0) {
        for (const v of input.variants) {
          const variant = memoryDb.insert("product_variants", {
            product_id: product.id,
            name: v.name.trim(),
            price_adjustment: v.priceAdjustment,
            sku: v.sku || null,
            is_active: true,
          });
          createdVariants.push(variant as ProductVariant);
        }
      }
      product.variants = createdVariants;
      const createdGroups: ModifierGroup[] = [];
      if (input.modifierGroupIds && input.modifierGroupIds.length > 0) {
        for (const gid of input.modifierGroupIds) {
          const g = await this.getModifierGroup(tenantId, gid);
          if (g) createdGroups.push(g);
        }
      }
      product.modifier_groups = createdGroups;
      return product;
    }

    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const prodRes = await client.query(
        `INSERT INTO products (
          tenant_id, category_id, name, description, base_price,
          currency, sku, image_url, is_active, tax_rate, modifier_group_ids
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          tenantId,
          productRecord.category_id,
          productRecord.name,
          productRecord.description,
          productRecord.base_price,
          productRecord.currency,
          productRecord.sku,
          productRecord.image_url,
          productRecord.is_active,
          productRecord.tax_rate,
          JSON.stringify(productRecord.modifier_group_ids),
        ]
      );
      product = prodRes.rows[0] as Product;

      const createdVariants: ProductVariant[] = [];
      if (input.variants && input.variants.length > 0) {
        for (const v of input.variants) {
          const varRes = await client.query(
            `INSERT INTO product_variants (product_id, name, price_adjustment, sku, is_active)
             VALUES ($1, $2, $3, $4, true) RETURNING *`,
            [product.id, v.name.trim(), v.priceAdjustment, v.sku || null]
          );
          createdVariants.push(varRes.rows[0] as ProductVariant);
        }
      }
      await client.query("COMMIT");
      product.variants = createdVariants;
      return product;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getProduct(tenantId: string, productId: string, branchId?: string): Promise<Product | null> {
    let product: Product | null = null;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const prods = memoryDb.find("products", (p: any) => p.id === productId && p.tenant_id === tenantId && !p.deleted_at);
      if (prods.length === 0) return null;
      product = { ...prods[0] } as Product;
      product.variants = memoryDb.find("product_variants", (v: any) => v.product_id === productId && v.is_active) as ProductVariant[];
    } else {
      const pool = getPostgresPool();
      const pRes = await pool.query(
        "SELECT * FROM products WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        [productId, tenantId]
      );
      if (pRes.rows.length === 0) return null;
      product = pRes.rows[0] as Product;
      const vRes = await pool.query("SELECT * FROM product_variants WHERE product_id = $1 AND is_active = true", [productId]);
      product.variants = vRes.rows as ProductVariant[];
    }

    // Attach modifier groups
    if (product.modifier_group_ids && product.modifier_group_ids.length > 0) {
      const groups: ModifierGroup[] = [];
      for (const gid of product.modifier_group_ids) {
        const g = await this.getModifierGroup(tenantId, gid);
        if (g) groups.push(g);
      }
      product.modifier_groups = groups;
    }

    // Check branch availability override
    if (branchId) {
      const override = await this.getBranchAvailability(tenantId, branchId, productId);
      if (override) {
        if (!override.is_available) {
          product.is_active = false;
        }
        if (override.override_price != null) {
          product.base_price = Number(override.override_price);
        }
      }
    }

    return product;
  }

  async listProducts(tenantId: string, categoryId?: string, branchId?: string): Promise<Product[]> {
    let rawProducts: any[] = [];
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      rawProducts = memoryDb.find("products", (p: any) => {
        if (p.tenant_id !== tenantId || p.deleted_at) return false;
        if (categoryId && p.category_id !== categoryId) return false;
        return true;
      });
    } else {
      const pool = getPostgresPool();
      let query = "SELECT * FROM products WHERE tenant_id = $1 AND deleted_at IS NULL";
      const params: any[] = [tenantId];
      if (categoryId) {
        query += " AND category_id = $2";
        params.push(categoryId);
      }
      const res = await pool.query(query, params);
      rawProducts = res.rows;
    }

    const hydrated: Product[] = [];
    for (const p of rawProducts) {
      const full = await this.getProduct(tenantId, p.id, branchId);
      if (full) hydrated.push(full);
    }
    return hydrated;
  }

  // ── Branch Availability Overrides ─────────────────────────────────────────

  async setBranchAvailability(
    tenantId: string,
    branchId: string,
    productId: string,
    isAvailable: boolean,
    overridePrice?: number | null
  ): Promise<BranchProductAvailability> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const existing = memoryDb.find(
        "branch_product_availability",
        (b: any) => b.branch_id === branchId && b.product_id === productId && b.tenant_id === tenantId
      );
      if (existing.length > 0) {
        return memoryDb.update("branch_product_availability", existing[0].id, {
          is_available: isAvailable,
          override_price: overridePrice ?? null,
        }) as BranchProductAvailability;
      }
      return memoryDb.insert("branch_product_availability", {
        tenant_id: tenantId,
        branch_id: branchId,
        product_id: productId,
        is_available: isAvailable,
        override_price: overridePrice ?? null,
      }) as BranchProductAvailability;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      `INSERT INTO branch_product_availability (tenant_id, branch_id, product_id, is_available, override_price)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, branch_id, product_id)
       DO UPDATE SET is_available = $4, override_price = $5
       RETURNING *`,
      [tenantId, branchId, productId, isAvailable, overridePrice ?? null]
    );
    return res.rows[0] as BranchProductAvailability;
  }

  async getBranchAvailability(
    tenantId: string,
    branchId: string,
    productId: string
  ): Promise<BranchProductAvailability | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const found = memoryDb.find(
        "branch_product_availability",
        (b: any) => b.branch_id === branchId && b.product_id === productId && b.tenant_id === tenantId
      );
      return found.length > 0 ? (found[0] as BranchProductAvailability) : null;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      "SELECT * FROM branch_product_availability WHERE tenant_id = $1 AND branch_id = $2 AND product_id = $3",
      [tenantId, branchId, productId]
    );
    return res.rows.length > 0 ? (res.rows[0] as BranchProductAvailability) : null;
  }

  // ── Order Item Validation & Price Calculation ─────────────────────────────

  async validateAndCalculateOrderItem(
    tenantId: string,
    branchId: string,
    item: {
      productId: string;
      variantId?: string | null;
      quantity: number;
      selectedModifiers?: Array<{ modifierId: string }>;
    }
  ): Promise<{
    name: string;
    unitPrice: number;
    totalPrice: number;
    modifiersDetail: Array<{ modifier_id: string; name: string; price: number }>;
  }> {
    const product = await this.getProduct(tenantId, item.productId, branchId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }
    if (!product.is_active) {
      throw new Error(`Product "${product.name}" is currently unavailable`);
    }

    let unitPrice = Number(product.base_price);
    let variantName = "";

    // Variant calculation
    if (item.variantId) {
      const variant = product.variants?.find((v) => v.id === item.variantId && v.is_active);
      if (!variant) {
        throw new Error(`Variant ${item.variantId} is invalid or inactive for product "${product.name}"`);
      }
      unitPrice += Number(variant.price_adjustment);
      variantName = ` - ${variant.name}`;
    }

    // Modifier validation & price additions
    const modifiersDetail: Array<{ modifier_id: string; name: string; price: number }> = [];
    const selectedModIds = new Set(item.selectedModifiers?.map((m) => m.modifierId) || []);

    if (product.modifier_groups && product.modifier_groups.length > 0) {
      for (const group of product.modifier_groups) {
        const groupMods = group.modifiers || [];
        const groupModIds = new Set(groupMods.map((m) => m.id));
        const selectedInGroup = [...selectedModIds].filter((id) => groupModIds.has(id));

        // Enforce min & max selection constraints
        if (selectedInGroup.length < group.min_selection) {
          throw new Error(
            `Modifier group "${group.name}" requires at least ${group.min_selection} selection(s)`
          );
        }
        if (selectedInGroup.length > group.max_selection) {
          throw new Error(
            `Modifier group "${group.name}" allows at most ${group.max_selection} selection(s)`
          );
        }

        for (const modId of selectedInGroup) {
          const mod = groupMods.find((m) => m.id === modId && m.is_active);
          if (!mod) {
            throw new Error(`Modifier ${modId} is invalid or inactive`);
          }
          const modPrice = Number(mod.price_adjustment);
          unitPrice += modPrice;
          modifiersDetail.push({
            modifier_id: mod.id,
            name: mod.name,
            price: modPrice,
          });
        }
      }
    }

    const totalPrice = Number((unitPrice * item.quantity).toFixed(2));

    return {
      name: `${product.name}${variantName}`,
      unitPrice: Number(unitPrice.toFixed(2)),
      totalPrice,
      modifiersDetail,
    };
  }
}

export const menuService = new MenuService();
