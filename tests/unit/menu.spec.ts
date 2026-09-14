import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { menuService } from "@/modules/menu/services/menu-service";

describe("Menu Catalog & Pricing Subsystem", () => {
  const tenantA = "org-tenant-a-111";
  const tenantB = "org-tenant-b-222";
  const branch1 = "branch-111-tel-aviv";
  const branch2 = "branch-222-ramat-gan";

  beforeEach(() => {
    memoryDb.reset();
  });

  it("creates categories and returns them in sort_order", async () => {
    await menuService.createCategory(tenantA, { name: "שתייה", sortOrder: 3 });
    await menuService.createCategory(tenantA, { name: "עיקריות", sortOrder: 1 });
    await menuService.createCategory(tenantA, { name: "ראשונות", sortOrder: 2 });

    const categories = await menuService.listCategories(tenantA);
    expect(categories).toHaveLength(3);
    expect(categories[0].name).toBe("עיקריות");
    expect(categories[1].name).toBe("ראשונות");
    expect(categories[2].name).toBe("שתייה");
  });

  it("creates products with variants and modifier groups", async () => {
    const cat = await menuService.createCategory(tenantA, { name: "המבורגרים" });

    const donenessGroup = await menuService.createModifierGroup(tenantA, {
      name: "מידת עשייה",
      minSelection: 1,
      maxSelection: 1,
      isRequired: true,
      modifiers: [
        { name: "M", priceAdjustment: 0 },
        { name: "MW", priceAdjustment: 0 },
        { name: "WD", priceAdjustment: 0 },
      ],
    });

    const product = await menuService.createProduct(tenantA, {
      categoryId: cat.id,
      name: "המבורגר שורטק",
      basePrice: 60,
      modifierGroupIds: [donenessGroup.id],
      variants: [
        { name: "רגיל 200 גרם", priceAdjustment: 0 },
        { name: "דאבל 400 גרם", priceAdjustment: 25 },
      ],
    });

    expect(product.id).toBeDefined();
    expect(product.variants).toHaveLength(2);
    expect(product.modifier_groups).toHaveLength(1);
    expect(product.modifier_groups![0].modifiers).toHaveLength(3);
  });

  it("calculates accurate item price with variant and modifier adjustments", async () => {
    const cat = await menuService.createCategory(tenantA, { name: "אוכל" });

    const toppingsGroup = await menuService.createModifierGroup(tenantA, {
      name: "תוספות מעל",
      minSelection: 0,
      maxSelection: 3,
      isRequired: false,
      modifiers: [
        { name: "גבינה צהובה", priceAdjustment: 6 },
        { name: "ביצה", priceAdjustment: 8 },
      ],
    });

    const product = await menuService.createProduct(tenantA, {
      categoryId: cat.id,
      name: "בורגר מיוחד",
      basePrice: 50,
      modifierGroupIds: [toppingsGroup.id],
      variants: [{ name: "גדול", priceAdjustment: 15 }],
    });

    const doubleVariant = product.variants![0];
    const cheeseMod = toppingsGroup.modifiers![0];
    const eggMod = toppingsGroup.modifiers![1];

    // Base (50) + Variant (15) + Cheese (6) + Egg (8) = 79 per unit * 2 = 158
    const calc = await menuService.validateAndCalculateOrderItem(tenantA, branch1, {
      productId: product.id,
      variantId: doubleVariant.id,
      quantity: 2,
      selectedModifiers: [{ modifierId: cheeseMod.id }, { modifierId: eggMod.id }],
    });

    expect(calc.unitPrice).toBe(79);
    expect(calc.totalPrice).toBe(158);
    expect(calc.name).toBe("בורגר מיוחד - גדול");
    expect(calc.modifiersDetail).toHaveLength(2);
  });

  it("enforces modifier group min and max selection constraints", async () => {
    const cat = await menuService.createCategory(tenantA, { name: "מנות" });

    const requiredChoice = await menuService.createModifierGroup(tenantA, {
      name: "בחירת לחמניה",
      minSelection: 1,
      maxSelection: 1,
      isRequired: true,
      modifiers: [
        { name: "לחמניה רגילה", priceAdjustment: 0 },
        { name: "לחמניה ללא גלוטן", priceAdjustment: 4 },
      ],
    });

    const product = await menuService.createProduct(tenantA, {
      categoryId: cat.id,
      name: "סנדוויץ'",
      basePrice: 30,
      modifierGroupIds: [requiredChoice.id],
    });

    // Failing min constraint (0 selected when min is 1)
    await expect(
      menuService.validateAndCalculateOrderItem(tenantA, branch1, {
        productId: product.id,
        quantity: 1,
        selectedModifiers: [],
      })
    ).rejects.toThrow(/requires at least 1 selection/i);

    // Failing max constraint (2 selected when max is 1)
    await expect(
      menuService.validateAndCalculateOrderItem(tenantA, branch1, {
        productId: product.id,
        quantity: 1,
        selectedModifiers: [
          { modifierId: requiredChoice.modifiers![0].id },
          { modifierId: requiredChoice.modifiers![1].id },
        ],
      })
    ).rejects.toThrow(/allows at most 1 selection/i);
  });

  it("supports branch-specific availability toggles and price overrides", async () => {
    const cat = await menuService.createCategory(tenantA, { name: "שתייה" });
    const product = await menuService.createProduct(tenantA, {
      categoryId: cat.id,
      name: "בירה מהחבית",
      basePrice: 28,
    });

    // In branch 1 (Tel Aviv): available at default price 28
    const pBranch1 = await menuService.getProduct(tenantA, product.id, branch1);
    expect(pBranch1?.is_active).toBe(true);
    expect(pBranch1?.base_price).toBe(28);

    // Override for branch 2 (Ramat Gan): custom price 32
    await menuService.setBranchAvailability(tenantA, branch2, product.id, true, 32);
    const pBranch2 = await menuService.getProduct(tenantA, product.id, branch2);
    expect(pBranch2?.is_active).toBe(true);
    expect(pBranch2?.base_price).toBe(32);

    // Disable in branch 1
    await menuService.setBranchAvailability(tenantA, branch1, product.id, false);
    const pBranch1Disabled = await menuService.getProduct(tenantA, product.id, branch1);
    expect(pBranch1Disabled?.is_active).toBe(false);

    // Validating order item in branch 1 must fail due to unavailability
    await expect(
      menuService.validateAndCalculateOrderItem(tenantA, branch1, {
        productId: product.id,
        quantity: 1,
      })
    ).rejects.toThrow(/currently unavailable/i);
  });

  it("enforces multi-tenant isolation on menu products", async () => {
    const catA = await menuService.createCategory(tenantA, { name: "פיצות" });
    const prodA = await menuService.createProduct(tenantA, {
      categoryId: catA.id,
      name: "פיצה מרגריטה",
      basePrice: 45,
    });

    // Tenant B cannot retrieve Tenant A's product
    const prodB = await menuService.getProduct(tenantB, prodA.id);
    expect(prodB).toBeNull();
  });
});
