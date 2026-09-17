import { describe, it, expect, beforeEach } from "vitest";
import { publicMenuService } from "@/modules/public-ordering/services/public-menu-service";
import { memoryDb } from "@/core/database/db";

describe("Phase 9: Public Menu Service", () => {
  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  it("should resolve restaurant context from slug", async () => {
    const context = await publicMenuService.resolveRestaurantContext("israeli-burgers");
    expect(context).toBeDefined();
    expect(context.tenantId).toBeDefined();
    expect(context.branchId).toBeDefined();
  });

  it("should retrieve public menu with active categories and products", async () => {
    const menuData = await publicMenuService.getPublicMenu("israeli-burgers");

    expect(menuData.restaurant).toBeDefined();
    expect(menuData.categories).toBeInstanceOf(Array);
    expect(menuData.categories.length).toBeGreaterThan(0);

    for (const cat of menuData.categories) {
      expect(cat.name).toBeDefined();
      expect(cat.products).toBeInstanceOf(Array);

      for (const prod of cat.products) {
        expect(prod.id).toBeDefined();
        expect(prod.name).toBeDefined();
        expect(prod.basePrice).toBeGreaterThan(0);
        expect(prod.isAvailable).toBe(true);

        // Security check: ensure no internal cost or BOM leak
        expect((prod as any).cost_price).toBeUndefined();
        expect((prod as any).bom).toBeUndefined();
        expect((prod as any).recipe_secret).toBeUndefined();
      }
    }
  });

  it("should return public restaurant profile with operating hours", async () => {
    const info = await publicMenuService.getRestaurantPublicInfo("israeli-burgers");

    expect(info.name).toBeDefined();
    expect(info.phone).toBeDefined();
    expect(info.address).toBeDefined();
    expect(info.deliveryFee).toBeGreaterThanOrEqual(0);
    expect(info.operatingHours.length).toBeGreaterThan(0);
    expect(info.features.delivery).toBe(true);
  });
});
