import { z } from "zod";

export interface MenuCategory {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export interface Modifier {
  id: string;
  modifier_group_id: string;
  name: string;
  price_adjustment: number;
  is_active: boolean;
}

export interface ModifierGroup {
  id: string;
  tenant_id: string;
  name: string;
  min_selection: number;
  max_selection: number;
  is_required: boolean;
  modifiers?: Modifier[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price_adjustment: number;
  sku?: string | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  base_price: number;
  currency: string;
  sku?: string | null;
  image_url?: string | null;
  is_active: boolean;
  tax_rate: number;
  modifier_group_ids?: string[];
  variants?: ProductVariant[];
  modifier_groups?: ModifierGroup[];
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export interface BranchProductAvailability {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  is_available: boolean;
  override_price?: number | null;
}

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const createProductSchema = z.object({
  categoryId: z.string().min(1, "Category ID is required"),
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  basePrice: z.number().nonnegative("Base price must be non-negative"),
  currency: z.string().default("ILS"),
  sku: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  taxRate: z.number().min(0).max(1).default(0.17),
  modifierGroupIds: z.array(z.string()).default([]),
  variants: z
    .array(
      z.object({
        name: z.string().min(1),
        priceAdjustment: z.number(),
        sku: z.string().optional(),
      })
    )
    .optional(),
});

export const createModifierGroupSchema = z.object({
  name: z.string().min(1, "Modifier group name is required"),
  minSelection: z.number().int().min(0).default(0),
  maxSelection: z.number().int().min(1).default(1),
  isRequired: z.boolean().default(false),
  modifiers: z
    .array(
      z.object({
        name: z.string().min(1),
        priceAdjustment: z.number().default(0),
      })
    )
    .min(1, "At least one modifier required"),
});
