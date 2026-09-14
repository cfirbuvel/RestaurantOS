import { memoryDb, getPostgresPool } from "@/core/database/db";
import {
  Recipe,
  RecipeItem,
  BOMCalculationResult,
  BOMExplosionItem,
  Ingredient,
} from "../domain/inventory";
import { unitConversionService } from "./unit-conversion-service";

export class RecipeService {
  /**
   * Create a new recipe with items
   */
  async createRecipe(params: {
    tenantId: string;
    productId?: string | null;
    variantId?: string | null;
    modifierId?: string | null;
    name: string;
    description?: string | null;
    yieldPortions?: number;
    prepTimeMinutes?: number;
    isSubRecipe?: boolean;
    items: Array<{
      ingredientId?: string | null;
      subRecipeId?: string | null;
      quantity: number;
      unitId: string;
      yieldPercentage?: number;
    }>;
  }): Promise<Recipe> {
    const {
      tenantId,
      productId,
      variantId,
      modifierId,
      name,
      description,
      yieldPortions = 1.0,
      prepTimeMinutes = 0,
      isSubRecipe = false,
      items,
    } = params;

    const recipeId = `rec_${crypto.randomUUID()}`;
    const now = new Date();

    const recipe: Recipe = {
      id: recipeId,
      tenant_id: tenantId,
      product_id: productId || null,
      variant_id: variantId || null,
      modifier_id: modifierId || null,
      name,
      description: description || null,
      yield_portions: yieldPortions,
      prep_time_minutes: prepTimeMinutes,
      is_sub_recipe: isSubRecipe,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const recipeItems: RecipeItem[] = items.map((it) => ({
      id: `ri_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      recipe_id: recipeId,
      ingredient_id: it.ingredientId || null,
      sub_recipe_id: it.subRecipeId || null,
      quantity: it.quantity,
      unit_id: it.unitId,
      yield_percentage: it.yieldPercentage || 100.0,
      created_at: now,
    }));

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("recipes", recipe);
      for (const item of recipeItems) {
        memoryDb.insert("recipe_items", item);
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO recipes (
          id, tenant_id, product_id, variant_id, modifier_id, name, description,
          yield_portions, prep_time_minutes, is_sub_recipe, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [
          recipe.id,
          recipe.tenant_id,
          recipe.product_id,
          recipe.variant_id,
          recipe.modifier_id,
          recipe.name,
          recipe.description,
          recipe.yield_portions,
          recipe.prep_time_minutes,
          recipe.is_sub_recipe,
          recipe.is_active,
        ]
      );

      for (const item of recipeItems) {
        await pool.query(
          `INSERT INTO recipe_items (
            id, tenant_id, recipe_id, ingredient_id, sub_recipe_id, quantity, unit_id, yield_percentage, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            item.id,
            item.tenant_id,
            item.recipe_id,
            item.ingredient_id,
            item.sub_recipe_id,
            item.quantity,
            item.unit_id,
            item.yield_percentage,
          ]
        );
      }
    }

    recipe.items = recipeItems;
    return recipe;
  }

  /**
   * Get recipe by ID with its items
   */
  async getRecipe(tenantId: string, recipeId: string): Promise<Recipe | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const recipe = memoryDb.findById("recipes", recipeId);
      if (!recipe || recipe.tenant_id !== tenantId) return null;

      const items = memoryDb.find(
        "recipe_items",
        (ri: any) => ri.tenant_id === tenantId && ri.recipe_id === recipeId
      );
      return { ...recipe, items };
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM recipes WHERE id = $1 AND tenant_id = $2",
        [recipeId, tenantId]
      );
      if (res.rows.length === 0) return null;
      const recipe = res.rows[0];

      const itemsRes = await pool.query(
        "SELECT * FROM recipe_items WHERE recipe_id = $1 AND tenant_id = $2",
        [recipeId, tenantId]
      );
      recipe.items = itemsRes.rows;
      return recipe;
    }
  }

  /**
   * Find recipe mapped to product / variant
   */
  async getRecipeForProduct(
    tenantId: string,
    productId: string,
    variantId?: string | null
  ): Promise<Recipe | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      // 1. Check variant-specific recipe
      if (variantId) {
        const variantRecipe = memoryDb.find(
          "recipes",
          (r: any) =>
            r.tenant_id === tenantId &&
            r.product_id === productId &&
            r.variant_id === variantId &&
            r.is_active
        )[0];
        if (variantRecipe) return this.getRecipe(tenantId, variantRecipe.id);
      }

      // 2. Base product recipe
      const baseRecipe = memoryDb.find(
        "recipes",
        (r: any) =>
          r.tenant_id === tenantId &&
          r.product_id === productId &&
          r.is_active
      )[0];
      return baseRecipe ? this.getRecipe(tenantId, baseRecipe.id) : null;
    } else {
      const pool = getPostgresPool();
      if (variantId) {
        const vRes = await pool.query(
          "SELECT id FROM recipes WHERE tenant_id = $1 AND product_id = $2 AND variant_id = $3 AND is_active = true LIMIT 1",
          [tenantId, productId, variantId]
        );
        if (vRes.rows.length > 0) {
          return this.getRecipe(tenantId, vRes.rows[0].id);
        }
      }

      const pRes = await pool.query(
        "SELECT id FROM recipes WHERE tenant_id = $1 AND product_id = $2 AND is_active = true LIMIT 1",
        [tenantId, productId]
      );
      return pRes.rows.length > 0 ? this.getRecipe(tenantId, pRes.rows[0].id) : null;
    }
  }

  /**
   * Find recipe mapped to a modifier option (e.g. Extra Cheddar)
   */
  async getRecipeForModifier(tenantId: string, modifierId: string): Promise<Recipe | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const modRecipe = memoryDb.find(
        "recipes",
        (r: any) => r.tenant_id === tenantId && r.modifier_id === modifierId && r.is_active
      )[0];
      return modRecipe ? this.getRecipe(tenantId, modRecipe.id) : null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT id FROM recipes WHERE tenant_id = $1 AND modifier_id = $2 AND is_active = true LIMIT 1",
        [tenantId, modifierId]
      );
      return res.rows.length > 0 ? this.getRecipe(tenantId, res.rows[0].id) : null;
    }
  }

  /**
   * Bill of Materials (BOM) Explosion:
   * Recursively explodes products, selected modifiers, and sub-recipes into required raw ingredients,
   * accounting for portion multipliers and yield losses, and computes theoretical food costs.
   */
  async calculateBOM(params: {
    tenantId: string;
    productId?: string | null;
    variantId?: string | null;
    selectedModifierIds?: string[];
    quantity?: number;
  }): Promise<BOMCalculationResult> {
    const { tenantId, productId, variantId, selectedModifierIds = [], quantity = 1 } = params;

    const itemsMap = new Map<string, BOMExplosionItem>();

    let recipeName = "Custom Calculation";
    let baseRecipe: Recipe | null = null;

    if (productId) {
      baseRecipe = await this.getRecipeForProduct(tenantId, productId, variantId);
      if (baseRecipe) {
        recipeName = baseRecipe.name;
        await this.explodeRecipe(tenantId, baseRecipe, quantity, itemsMap);
      }
    }

    // Explode any modifier additions (e.g. Extra Patty, Bacon, Cheddar)
    for (const modId of selectedModifierIds) {
      const modRecipe = await this.getRecipeForModifier(tenantId, modId);
      if (modRecipe) {
        await this.explodeRecipe(tenantId, modRecipe, quantity, itemsMap);
      }
    }

    const items = Array.from(itemsMap.values());
    const theoreticalFoodCost = Number(
      items.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)
    );

    return {
      productId: productId || null,
      recipeName,
      portions: quantity,
      theoreticalFoodCost,
      items,
    };
  }

  private async explodeRecipe(
    tenantId: string,
    recipe: Recipe,
    multiplier: number,
    accumulator: Map<string, BOMExplosionItem>
  ): Promise<void> {
    if (!recipe.items || recipe.items.length === 0) return;

    for (const item of recipe.items) {
      // 1. Direct ingredient item
      if (item.ingredient_id) {
        const ingredient = await this.getIngredient(tenantId, item.ingredient_id);
        if (ingredient) {
          // Adjust for recipe yield percentage (loss in preparation/cooking)
          const yieldFactor = (item.yield_percentage || 100.0) / 100.0;
          const grossQuantity = (item.quantity * multiplier) / yieldFactor;

          // Convert quantity to ingredient primary unit for accurate cost evaluation
          let normalizedQuantity = grossQuantity;
          if (item.unit_id !== ingredient.primary_unit_id) {
            normalizedQuantity = await unitConversionService.convertQuantity({
              tenantId,
              fromUnitId: item.unit_id,
              toUnitId: ingredient.primary_unit_id,
              quantity: grossQuantity,
            });
          }

          const unitCost = Number(ingredient.cost_per_unit || 0);
          const totalCost = Number((normalizedQuantity * unitCost).toFixed(4));

          const existing = accumulator.get(ingredient.id);
          if (existing) {
            existing.quantity += normalizedQuantity;
            existing.totalCost += totalCost;
          } else {
            accumulator.set(ingredient.id, {
              ingredientId: ingredient.id,
              ingredientName: ingredient.name,
              sku: ingredient.sku,
              quantity: Number(normalizedQuantity.toFixed(4)),
              unitId: ingredient.primary_unit_id,
              unitCost,
              totalCost,
            });
          }
        }
      }

      // 2. Nested Sub-recipe item (recursive explosion)
      if (item.sub_recipe_id) {
        const subRecipe = await this.getRecipe(tenantId, item.sub_recipe_id);
        if (subRecipe) {
          await this.explodeRecipe(
            tenantId,
            subRecipe,
            multiplier * item.quantity,
            accumulator
          );
        }
      }
    }
  }

  private async getIngredient(tenantId: string, ingredientId: string): Promise<Ingredient | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const ing = memoryDb.findById("ingredients", ingredientId);
      return ing && ing.tenant_id === tenantId ? ing : null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM ingredients WHERE id = $1 AND tenant_id = $2",
        [ingredientId, tenantId]
      );
      return res.rows.length > 0 ? res.rows[0] : null;
    }
  }

  async listRecipes(tenantId: string): Promise<Recipe[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const recipes = memoryDb.find("recipes", (r: any) => r.tenant_id === tenantId);
      return recipes.map((r: any) => ({
        ...r,
        items: memoryDb.find(
          "recipe_items",
          (ri: any) => ri.tenant_id === tenantId && ri.recipe_id === r.id
        ),
      }));
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM recipes WHERE tenant_id = $1 ORDER BY name ASC",
        [tenantId]
      );
      return res.rows;
    }
  }
}

export const recipeService = new RecipeService();
