import { z } from "zod";

// ============================================================================
// Phase 5: Inventory, Warehouse, Supplier & Recipe Enums
// ============================================================================

export type UnitDimension = "WEIGHT" | "VOLUME" | "UNIT" | "PACKAGE";

export type WarehouseType =
  | "MAIN_WAREHOUSE"
  | "KITCHEN"
  | "WALK_IN_FREEZER"
  | "DRY_STORAGE"
  | "BAR"
  | "COMMISSARY";

export type MovementType =
  | "RECEIPT"
  | "SALE_DEPLETION"
  | "SALE_ROLLBACK"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "WASTE"
  | "COUNT_ADJUSTMENT"
  | "RETURN";

export type DepletionPolicy = "ON_ACCEPTED" | "ON_PREPARATION_START" | "ON_FULFILLMENT";

export type POStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type TransferStatus =
  | "REQUESTED"
  | "APPROVED"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "REJECTED";

export type WasteReason =
  | "EXPIRED"
  | "SPOILED"
  | "PREP_MISTAKE"
  | "DROPPED"
  | "SPILLAGE"
  | "THEFT"
  | "SAMPLE";

export type CountStatus = "IN_PROGRESS" | "COMPLETED" | "RECONCILED" | "CANCELLED";

// ============================================================================
// Phase 5: Domain Interfaces
// ============================================================================

export interface UnitOfMeasure {
  id: string;
  tenant_id?: string | null;
  name: string;
  symbol: string;
  dimension: UnitDimension;
  base_unit_id?: string | null;
  conversion_factor: number;
  is_system: boolean;
  created_at?: Date | string;
}

export interface UnitConversion {
  id: string;
  tenant_id?: string | null;
  from_unit_id: string;
  to_unit_id: string;
  factor: number;
  created_at?: Date | string;
}

export interface Ingredient {
  id: string;
  tenant_id: string;
  name: string;
  sku: string;
  category?: string | null;
  primary_unit_id: string;
  storage_unit_id: string;
  cost_per_unit: number;
  currency: string;
  minimum_stock_level: number;
  reorder_point: number;
  reorder_quantity: number;
  allergens: string[];
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Warehouse {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  warehouse_type: WarehouseType;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface StorageLocation {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  name: string;
  zone?: string | null;
  shelf?: string | null;
  bin?: string | null;
  is_active: boolean;
  created_at: Date | string;
}

export interface InventoryStock {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  ingredient_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  last_counted_at?: Date | string | null;
  updated_at: Date | string;
  ingredient?: Ingredient;
  warehouse?: Warehouse;
}

export interface RecipeItem {
  id: string;
  tenant_id: string;
  recipe_id: string;
  ingredient_id?: string | null;
  sub_recipe_id?: string | null;
  quantity: number;
  unit_id: string;
  yield_percentage: number;
  created_at: Date | string;
  ingredient?: Ingredient;
  sub_recipe?: Recipe;
}

export interface Recipe {
  id: string;
  tenant_id: string;
  product_id?: string | null;
  variant_id?: string | null;
  modifier_id?: string | null;
  name: string;
  description?: string | null;
  yield_portions: number;
  prep_time_minutes: number;
  is_sub_recipe: boolean;
  is_active: boolean;
  items?: RecipeItem[];
  created_at: Date | string;
  updated_at: Date | string;
}

export interface BOMExplosionItem {
  ingredientId: string;
  ingredientName: string;
  sku: string;
  quantity: number;
  unitId: string;
  unitCost: number;
  totalCost: number;
  warehouseType?: WarehouseType;
}

export interface BOMCalculationResult {
  productId?: string | null;
  recipeName: string;
  portions: number;
  theoreticalFoodCost: number;
  items: BOMExplosionItem[];
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  payment_terms?: string | null;
  lead_time_days: number;
  tax_id?: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SupplierItem {
  id: string;
  tenant_id: string;
  supplier_id: string;
  ingredient_id: string;
  supplier_sku?: string | null;
  purchase_unit_id: string;
  cost_price: number;
  currency: string;
  minimum_order_quantity: number;
  is_preferred: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  ingredient?: Ingredient;
}

export interface PurchaseOrderItem {
  id: string;
  tenant_id: string;
  purchase_order_id: string;
  ingredient_id: string;
  ordered_quantity: number;
  received_quantity: number;
  unit_id: string;
  unit_price: number;
  total_price: number;
  created_at: Date | string;
  ingredient?: Ingredient;
}

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  branch_id: string;
  supplier_id: string;
  destination_warehouse_id: string;
  po_number: string;
  status: POStatus;
  total_amount: number;
  currency: string;
  expected_delivery_date?: string | Date | null;
  submitted_at?: Date | string | null;
  received_at?: Date | string | null;
  notes?: string | null;
  created_by?: string | null;
  items?: PurchaseOrderItem[];
  created_at: Date | string;
  updated_at: Date | string;
}

export interface GoodsReceiptItem {
  id: string;
  tenant_id: string;
  goods_receipt_id: string;
  ingredient_id: string;
  quantity: number;
  unit_id: string;
  unit_cost: number;
  created_at: Date | string;
}

export interface GoodsReceipt {
  id: string;
  tenant_id: string;
  purchase_order_id?: string | null;
  warehouse_id: string;
  receipt_number: string;
  idempotency_key?: string | null;
  received_by?: string | null;
  received_at: Date | string;
  notes?: string | null;
  items?: GoodsReceiptItem[];
}

export interface StockMovement {
  id: string;
  tenant_id: string;
  ingredient_id: string;
  source_warehouse_id?: string | null;
  destination_warehouse_id?: string | null;
  movement_type: MovementType;
  quantity: number;
  unit_id: string;
  unit_cost: number;
  total_cost: number;
  reference_type?: string | null;
  reference_id?: string | null;
  idempotency_key?: string | null;
  actor_id?: string | null;
  notes?: string | null;
  created_at: Date | string;
}

export interface InventoryTransferItem {
  id: string;
  tenant_id: string;
  transfer_id: string;
  ingredient_id: string;
  quantity: number;
  unit_id: string;
  received_quantity?: number | null;
  created_at: Date | string;
}

export interface InventoryTransfer {
  id: string;
  tenant_id: string;
  transfer_number: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  status: TransferStatus;
  requested_by?: string | null;
  approved_by?: string | null;
  dispatched_at?: Date | string | null;
  completed_at?: Date | string | null;
  notes?: string | null;
  items?: InventoryTransferItem[];
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WasteRecord {
  id: string;
  tenant_id: string;
  branch_id: string;
  warehouse_id: string;
  ingredient_id: string;
  quantity: number;
  unit_id: string;
  waste_reason: WasteReason;
  cost_impact: number;
  reported_by?: string | null;
  notes?: string | null;
  created_at: Date | string;
}

export interface InventoryCountItem {
  id: string;
  tenant_id: string;
  count_id: string;
  ingredient_id: string;
  system_quantity: number;
  counted_quantity: number;
  variance: number;
  unit_id: string;
  unit_cost: number;
  variance_cost: number;
  reconciled: boolean;
  created_at: Date | string;
  ingredient?: Ingredient;
}

export interface InventoryCount {
  id: string;
  tenant_id: string;
  branch_id: string;
  warehouse_id: string;
  count_number: string;
  status: CountStatus;
  counted_by?: string | null;
  reconciled_by?: string | null;
  started_at: Date | string;
  completed_at?: Date | string | null;
  reconciled_at?: Date | string | null;
  notes?: string | null;
  items?: InventoryCountItem[];
  created_at: Date | string;
  updated_at: Date | string;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const createIngredientSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().optional(),
  primaryUnitId: z.string().min(1),
  storageUnitId: z.string().min(1),
  costPerUnit: z.number().nonnegative(),
  currency: z.string().default("ILS"),
  minimumStockLevel: z.number().nonnegative().default(0),
  reorderPoint: z.number().nonnegative().default(0),
  reorderQuantity: z.number().nonnegative().default(0),
  allergens: z.array(z.string()).default([]),
});

export const updateIngredientSchema = createIngredientSchema.partial();

export const createWarehouseSchema = z.object({
  name: z.string().min(1),
  warehouseType: z.enum([
    "MAIN_WAREHOUSE",
    "KITCHEN",
    "WALK_IN_FREEZER",
    "DRY_STORAGE",
    "BAR",
    "COMMISSARY",
  ]),
});

export const adjustStockSchema = z.object({
  warehouseId: z.string().min(1),
  ingredientId: z.string().min(1),
  adjustmentQuantity: z.number(), // positive to add, negative to deduct
  unitId: z.string().min(1),
  reason: z.string().min(1),
  referenceType: z.enum(["MANUAL", "CORRECTION", "STOCK_TAKE"]).default("MANUAL"),
});

export const createRecipeSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  modifierId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  yieldPortions: z.number().positive().default(1),
  prepTimeMinutes: z.number().int().nonnegative().default(0),
  isSubRecipe: z.boolean().default(false),
  items: z.array(
    z.object({
      ingredientId: z.string().optional(),
      subRecipeId: z.string().optional(),
      quantity: z.number().positive(),
      unitId: z.string().min(1),
      yieldPercentage: z.number().positive().max(100).default(100),
    })
  ).min(1),
});

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  paymentTerms: z.string().optional(),
  leadTimeDays: z.number().int().nonnegative().default(1),
  taxId: z.string().optional(),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  destinationWarehouseId: z.string().min(1),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().min(1),
      orderedQuantity: z.number().positive(),
      unitId: z.string().min(1),
      unitPrice: z.number().nonnegative(),
    })
  ).min(1),
});

export const receiveGoodsSchema = z.object({
  warehouseId: z.string().min(1),
  idempotencyKey: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().min(1),
      quantity: z.number().positive(),
      unitId: z.string().min(1),
      unitCost: z.number().nonnegative(),
    })
  ).min(1),
});

export const createTransferSchema = z.object({
  sourceWarehouseId: z.string().min(1),
  destinationWarehouseId: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().min(1),
      quantity: z.number().positive(),
      unitId: z.string().min(1),
    })
  ).min(1),
});

export const createWasteRecordSchema = z.object({
  warehouseId: z.string().min(1),
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unitId: z.string().min(1),
  wasteReason: z.enum([
    "EXPIRED",
    "SPOILED",
    "PREP_MISTAKE",
    "DROPPED",
    "SPILLAGE",
    "THEFT",
    "SAMPLE",
  ]),
  notes: z.string().optional(),
});

export const createInventoryCountSchema = z.object({
  warehouseId: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().min(1),
      countedQuantity: z.number().nonnegative(),
      unitId: z.string().min(1),
    })
  ),
});
