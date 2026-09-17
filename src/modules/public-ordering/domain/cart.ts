import { z } from "zod";

export interface SelectedModifier {
  modifierId: string;
  name?: string;
  priceAdjustment?: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  basePrice: number;
  quantity: number;
  variantId?: string | null;
  selectedModifiers: SelectedModifier[];
  notes?: string;
  itemTotal: number;
}

export type OrderType = "DELIVERY" | "TAKEAWAY" | "DINE_IN";

export interface Cart {
  items: CartItem[];
  orderType: OrderType;
  couponCode?: string | null;
  discountAmount: number;
  deliveryFee: number;
  tipAmount: number;
  subtotal: number;
  vatRate: number; // e.g. 0.17 for Israel 17%
  vatAmount: number;
  totalAmount: number;
}

export const selectedModifierSchema = z.object({
  modifierId: z.string().min(1, "Modifier ID is required"),
  name: z.string().optional(),
  priceAdjustment: z.number().default(0),
});

export const cartItemSchema = z.object({
  id: z.string().default(() => `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
  productId: z.string().min(1, "Product ID is required"),
  name: z.string().min(1, "Product name is required"),
  basePrice: z.number().min(0, "Price cannot be negative"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(99, "Max quantity per item is 99"),
  variantId: z.string().nullable().optional(),
  selectedModifiers: z.array(selectedModifierSchema).default([]),
  notes: z.string().max(250).optional(),
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  orderType: z.enum(["DELIVERY", "TAKEAWAY", "DINE_IN"]).default("DELIVERY"),
  couponCode: z.string().nullable().optional(),
  discountAmount: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(0),
  tipAmount: z.number().min(0).default(0),
  vatRate: z.number().min(0).default(0.17),
});

/**
 * Calculates item total given base price, modifiers and quantity
 */
export function calculateItemTotal(
  basePrice: number,
  selectedModifiers: SelectedModifier[],
  quantity: number
): number {
  const modTotal = selectedModifiers.reduce((sum, m) => sum + (m.priceAdjustment || 0), 0);
  const singleUnitPrice = Math.max(0, basePrice + modTotal);
  return Number((singleUnitPrice * quantity).toFixed(2));
}

/**
 * Computes subtotal, tax breakdown, and final total for a cart.
 */
export function calculateCartTotals(
  items: CartItem[],
  orderType: OrderType,
  options: {
    deliveryFee?: number;
    discountAmount?: number;
    tipAmount?: number;
    vatRate?: number;
  } = {}
): Cart {
  const deliveryFee = orderType === "DELIVERY" ? (options.deliveryFee ?? 0) : 0;
  const discountAmount = Math.max(0, options.discountAmount ?? 0);
  const tipAmount = Math.max(0, options.tipAmount ?? 0);
  const vatRate = options.vatRate ?? 0.17;

  // Recalculate each item total
  const calculatedItems = items.map((item) => {
    const itemTotal = calculateItemTotal(item.basePrice, item.selectedModifiers, item.quantity);
    return { ...item, itemTotal };
  });

  const subtotal = Number(calculatedItems.reduce((acc, it) => acc + it.itemTotal, 0).toFixed(2));
  
  // Discount cannot exceed subtotal
  const effectiveDiscount = Math.min(subtotal, discountAmount);
  const discountedSubtotal = Number((subtotal - effectiveDiscount).toFixed(2));
  
  const taxableAmount = discountedSubtotal + deliveryFee;
  // Prices in Israeli POS/web are inclusive of VAT by default, calculate embedded VAT
  const vatAmount = Number((taxableAmount - taxableAmount / (1 + vatRate)).toFixed(2));
  
  const totalAmount = Number((discountedSubtotal + deliveryFee + tipAmount).toFixed(2));

  return {
    items: calculatedItems,
    orderType,
    discountAmount: effectiveDiscount,
    deliveryFee,
    tipAmount,
    subtotal,
    vatRate,
    vatAmount,
    totalAmount,
  };
}

export interface CartValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateCartConstraints(
  cart: Cart,
  rules: {
    minOrderAmount?: number;
    maxItemsCount?: number;
    deliveryAvailable?: boolean;
  } = {}
): CartValidationResult {
  const errors: string[] = [];

  if (!cart.items || cart.items.length === 0) {
    errors.push("CART_EMPTY: סל ההזמנות ריק");
  }

  const totalItemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  if (rules.maxItemsCount && totalItemCount > rules.maxItemsCount) {
    errors.push(`MAX_ITEMS_EXCEEDED: כמות הפריטים המקסימלית להזמנה הינה ${rules.maxItemsCount}`);
  }

  if (cart.orderType === "DELIVERY") {
    if (rules.deliveryAvailable === false) {
      errors.push("DELIVERY_NOT_AVAILABLE: שירות המשלוחים אינו זמין כעת");
    }
    if (rules.minOrderAmount && cart.subtotal < rules.minOrderAmount) {
      errors.push(`MIN_ORDER_NOT_MET: מינימום הזמנה למשלוח הינו ₪${rules.minOrderAmount}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
