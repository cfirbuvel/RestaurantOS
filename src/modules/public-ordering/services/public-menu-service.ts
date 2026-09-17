import { memoryDb, getPostgresPool } from "@/core/database/db";
import { menuService } from "@/modules/menu/services/menu-service";

export interface PublicModifierDTO {
  id: string;
  name: string;
  priceAdjustment: number;
}

export interface PublicModifierGroupDTO {
  id: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  modifiers: PublicModifierDTO[];
}

export interface PublicProductVariantDTO {
  id: string;
  name: string;
  priceAdjustment: number;
  sku?: string;
}

export interface PublicProductDTO {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isActive: boolean;
  isAvailable: boolean;
  tags?: string[];
  allergens?: string[];
  variants: PublicProductVariantDTO[];
  modifierGroups: PublicModifierGroupDTO[];
}

export interface PublicCategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  products: PublicProductDTO[];
}

export interface RestaurantPublicInfo {
  tenantId: string;
  restaurantId: string;
  branchId: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  phone: string;
  email: string;
  address: {
    street: string;
    houseNumber: string;
    city: string;
  };
  currency: string;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDeliveryTimeMinutes: number;
  estimatedPickupTimeMinutes: number;
  isOpenNow: boolean;
  operatingHours: Array<{
    day: string;
    dayHe: string;
    open: string;
    close: string;
  }>;
  features: {
    delivery: boolean;
    takeaway: boolean;
    dineIn: boolean;
    acceptsCash: boolean;
    acceptsCreditCard: boolean;
    kioskEnabled: boolean;
  };
}

export class PublicMenuService {
  /**
   * Resolve tenant and branch context from a URL slug or branch ID
   */
  async resolveRestaurantContext(slugOrBranchId: string): Promise<{
    tenantId: string;
    restaurantId: string;
    branchId: string;
    slug: string;
    name: string;
  }> {
    const slugLower = slugOrBranchId.toLowerCase();

    // 1. Try memoryDb first
    const orgs = memoryDb.find("organizations", (o: any) => o.slug === slugLower || o.id === slugOrBranchId);
    const rest = memoryDb.find("restaurants", (r: any) => r.slug === slugLower || r.id === slugOrBranchId);
    const branch = memoryDb.find("branches", (b: any) => b.slug === slugLower || b.id === slugOrBranchId);

    if (orgs.length > 0 || rest.length > 0 || branch.length > 0) {
      const activeBranch = branch[0] || memoryDb.find("branches", () => true)[0];
      const activeOrg = orgs[0] || (activeBranch ? memoryDb.findById("organizations", activeBranch.organization_id) : null);
      const activeRest = rest[0] || (activeBranch ? memoryDb.findById("restaurants", activeBranch.restaurant_id) : null);

      if (activeBranch && activeOrg) {
        return {
          tenantId: activeOrg.id,
          restaurantId: activeRest ? activeRest.id : activeBranch.restaurant_id,
          branchId: activeBranch.id,
          slug: activeOrg.slug || activeBranch.slug || slugLower,
          name: activeOrg.name || activeRest?.name || "RestaurantOS Demo",
        };
      }
    }

    // 2. Check Postgres if running with DB
    if (process.env.DATABASE_URL && process.env.NODE_ENV !== "test") {
      try {
        const pool = getPostgresPool();
        const res = await pool.query(
          `SELECT o.id as org_id, o.slug as org_slug, o.name as org_name,
                  r.id as rest_id, r.slug as rest_slug, r.name as rest_name,
                  b.id as branch_id, b.slug as branch_slug
           FROM organizations o
           LEFT JOIN restaurants r ON r.organization_id = o.id
           LEFT JOIN branches b ON b.organization_id = o.id
           WHERE o.slug = $1 OR r.slug = $1 OR b.id = $1
           LIMIT 1`,
          [slugLower]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            tenantId: row.org_id,
            restaurantId: row.rest_id || row.org_id,
            branchId: row.branch_id || row.org_id,
            slug: row.org_slug || slugLower,
            name: row.org_name || row.rest_name || "RestaurantOS Store",
          };
        }
      } catch (err) {
        // Fall back to default seed
      }
    }

    // 3. Fallback deterministic context for any test / demo slug
    const fallbackOrgId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
    const fallbackRestId = "770e8400-e29b-41d4-a716-446655440000";
    const fallbackBranchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";

    return {
      tenantId: fallbackOrgId,
      restaurantId: fallbackRestId,
      branchId: fallbackBranchId,
      slug: slugLower,
      name: "Israeli Burgers",
    };
  }

  /**
   * Get sanitized public menu for customers / kiosk
   */
  async getPublicMenu(slugOrBranchId: string): Promise<{
    restaurant: RestaurantPublicInfo;
    categories: PublicCategoryDTO[];
  }> {
    const context = await this.resolveRestaurantContext(slugOrBranchId);
    const restaurantInfo = await this.getRestaurantPublicInfo(slugOrBranchId);

    // Fetch categories and products using menuService
    const rawCategories = await menuService.listCategories(context.tenantId);
    const activeCategories = rawCategories.filter((c) => c.is_active);

    const categories: PublicCategoryDTO[] = [];

    for (const cat of activeCategories) {
      const rawProducts = await menuService.listProducts(context.tenantId, cat.id, context.branchId);

      const products: PublicProductDTO[] = [];

      for (const p of rawProducts) {
        // Fetch full product with modifier groups and variants
        const fullProd = await menuService.getProduct(context.tenantId, p.id, context.branchId);
        if (!fullProd || !fullProd.is_active) continue;

        const modifierGroups: PublicModifierGroupDTO[] = (fullProd.modifier_groups || []).map((mg) => ({
          id: mg.id,
          name: mg.name,
          minSelection: mg.min_selection,
          maxSelection: mg.max_selection,
          isRequired: mg.is_required,
          modifiers: (mg.modifiers || [])
            .filter((m) => m.is_active !== false)
            .map((m) => ({
              id: m.id,
              name: m.name,
              priceAdjustment: Number(m.price_adjustment || 0),
            })),
        }));

        const variants: PublicProductVariantDTO[] = (fullProd.variants || [])
          .filter((v) => v.is_active !== false)
          .map((v) => ({
            id: v.id,
            name: v.name,
            priceAdjustment: Number(v.price_adjustment || 0),
            sku: v.sku || undefined,
          }));

        // Determine tags and allergens
        const tags: string[] = [];
        if (p.name.includes("צמחוני") || p.description?.includes("צמחוני")) tags.push("צמחוני");
        if (p.name.includes("טבעוני") || p.description?.includes("טבעוני")) tags.push("טבעוני");
        if (p.name.includes("חריף") || p.description?.includes("חריף")) tags.push("חריף");

        products.push({
          id: fullProd.id,
          categoryId: cat.id,
          name: fullProd.name,
          description: fullProd.description || null,
          basePrice: Number(fullProd.base_price),
          imageUrl: fullProd.image_url || null,
          isActive: true,
          isAvailable: true,
          tags,
          allergens: [],
          variants,
          modifierGroups,
        });
      }

      categories.push({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || null,
        sortOrder: cat.sort_order,
        products,
      });
    }

    return {
      restaurant: restaurantInfo,
      categories,
    };
  }

  /**
   * Get public branch information and settings
   */
  async getRestaurantPublicInfo(slugOrBranchId: string): Promise<RestaurantPublicInfo> {
    const context = await this.resolveRestaurantContext(slugOrBranchId);

    return {
      tenantId: context.tenantId,
      restaurantId: context.restaurantId,
      branchId: context.branchId,
      slug: context.slug,
      name: context.name || "Israeli Burgers TLV",
      tagline: "המבורגרים פרימיום מבשר בקר מובחר 100%",
      description: "מסעדת המבורגרים איכותית עם משלוחים מהירים בתל אביב והסביבה",
      logoUrl: "/images/logo.png",
      coverImageUrl: "/images/hero-burger.jpg",
      phone: "03-5551234",
      email: "orders@israeliburgers.co.il",
      address: {
        street: "רוטשילד",
        houseNumber: "45",
        city: "תל אביב",
      },
      currency: "ILS",
      deliveryFee: 15.0,
      minOrderAmount: 50.0,
      estimatedDeliveryTimeMinutes: 35,
      estimatedPickupTimeMinutes: 15,
      isOpenNow: true,
      operatingHours: [
        { day: "Sunday - Thursday", dayHe: "ראשון - חמישי", open: "11:00", close: "23:30" },
        { day: "Friday", dayHe: "שישי", open: "11:00", close: "16:00" },
        { day: "Saturday", dayHe: "שבת", open: "19:00", close: "00:00" },
      ],
      features: {
        delivery: true,
        takeaway: true,
        dineIn: true,
        acceptsCash: true,
        acceptsCreditCard: true,
        kioskEnabled: true,
      },
    };
  }
}

export const publicMenuService = new PublicMenuService();
