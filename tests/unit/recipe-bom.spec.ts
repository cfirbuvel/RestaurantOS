import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { recipeService } from "@/modules/inventory/services/recipe-service";

describe("Phase 5: Recipes & BOM Explosion Engine", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  describe("Recipe Management", () => {
    it("lists seeded recipes for products and modifiers", async () => {
      const recipes = await recipeService.listRecipes(tenantId);
      expect(recipes.length).toBeGreaterThanOrEqual(3);

      const classicBurgerRecipe = recipes.find((r) => r.product_id === "prod-01-classic-burger");
      expect(classicBurgerRecipe).toBeDefined();
      expect(classicBurgerRecipe?.items?.length).toBe(3); // Beef, Bun, Sauce
    });

    it("creates a new recipe with items and yield percentages", async () => {
      const newRecipe = await recipeService.createRecipe({
        tenantId,
        productId: "prod-02-fries",
        name: "מתכון מנה כפולה",
        yieldPortions: 1,
        prepTimeMinutes: 10,
        items: [
          {
            ingredientId: "ing-01-beef-patty",
            quantity: 440,
            unitId: "g",
            yieldPercentage: 95,
          },
          {
            ingredientId: "ing-02-burger-bun",
            quantity: 1,
            unitId: "unit",
            yieldPercentage: 100,
          },
        ],
      });

      expect(newRecipe.id).toBeDefined();
      expect(newRecipe.items?.length).toBe(2);
    });
  });

  describe("BOM Explosion & Theoretical Food Cost", () => {
    it("calculates BOM breakdown with yield factor for single portion", async () => {
      const bom = await recipeService.calculateBOM({
        tenantId,
        productId: "prod-01-classic-burger",
        quantity: 1,
      });

      expect(bom.productId).toBe("prod-01-classic-burger");
      expect(bom.portions).toBe(1);
      expect(bom.items.length).toBe(3);

      // Check Beef calculation:
      // Net: 220g. Yield: 95%. Gross required: 220 / 0.95 = 231.5789g
      const beefItem = bom.items.find((i) => i.ingredientId === "ing-01-beef-patty");
      expect(beefItem).toBeDefined();
      expect(beefItem?.quantity).toBeCloseTo(231.5789, 2);
      expect(beefItem?.unitCost).toBe(0.075);
      expect(beefItem?.totalCost).toBeCloseTo(231.5789 * 0.075, 2);

      // Check Bun calculation:
      // Net: 1 unit. Yield: 100%. Cost: 2.20
      const bunItem = bom.items.find((i) => i.ingredientId === "ing-02-burger-bun");
      expect(bunItem).toBeDefined();
      expect(bunItem?.quantity).toBe(1);
      expect(bunItem?.totalCost).toBe(2.20);

      // Total theoretical food cost should be sum of items
      const expectedTotal = bom.items.reduce((sum, i) => sum + i.totalCost, 0);
      expect(bom.theoreticalFoodCost).toBeCloseTo(expectedTotal, 2);
    });

    it("multiplies BOM quantities for multiple portions (e.g. 5 burgers)", async () => {
      const bom5 = await recipeService.calculateBOM({
        tenantId,
        productId: "prod-01-classic-burger",
        quantity: 5,
      });

      expect(bom5.portions).toBe(5);
      const bunItem = bom5.items.find((i) => i.ingredientId === "ing-02-burger-bun");
      expect(bunItem?.quantity).toBe(5);
      expect(bunItem?.totalCost).toBeCloseTo(11.0, 2);
    });

    it("explodes modifier recipes when selectedModifierIds are passed", async () => {
      const bomWithCheddar = await recipeService.calculateBOM({
        tenantId,
        productId: "prod-01-classic-burger",
        selectedModifierIds: ["mod-cheddar"],
        quantity: 2,
      });

      // 3 base items + 1 cheddar modifier item = 4 items
      expect(bomWithCheddar.items.length).toBe(4);

      const cheddarItem = bomWithCheddar.items.find((i) => i.ingredientId === "ing-03-cheddar-slice");
      expect(cheddarItem).toBeDefined();
      expect(cheddarItem?.quantity).toBe(2); // 2 portions = 2 slices
      expect(cheddarItem?.totalCost).toBe(2.20); // 2 * 1.10
    });
  });
});
