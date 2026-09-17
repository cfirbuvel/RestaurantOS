"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Cart,
  CartItem,
  OrderType,
  SelectedModifier,
  calculateCartTotals,
} from "@/modules/public-ordering/domain/cart";

interface CartContextType {
  cart: Cart;
  isDrawerOpen: boolean;
  totalItemsCount: number;
  addItem: (item: {
    productId: string;
    name: string;
    basePrice: number;
    quantity: number;
    variantId?: string | null;
    selectedModifiers?: SelectedModifier[];
    notes?: string;
  }) => void;
  updateQuantity: (itemId: string, newQuantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  setOrderType: (orderType: OrderType) => void;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  setTipAmount: (amount: number) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const initialCart: Cart = {
  items: [],
  orderType: "DELIVERY",
  couponCode: null,
  discountAmount: 0,
  deliveryFee: 15.0,
  tipAmount: 0,
  subtotal: 0,
  vatRate: 0.17,
  vatAmount: 0,
  totalAmount: 0,
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({
  children,
  slug,
  defaultDeliveryFee = 15.0,
  isKiosk = false,
}: {
  children: React.ReactNode;
  slug: string;
  defaultDeliveryFee?: number;
  isKiosk?: boolean;
}) {
  const storageKey = `restaurantos_cart_${slug}`;
  const [cart, setCart] = useState<Cart>(() => ({
    ...initialCart,
    orderType: isKiosk ? "DINE_IN" : "DELIVERY",
    deliveryFee: isKiosk ? 0 : defaultDeliveryFee,
  }));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage for website only
  useEffect(() => {
    if (!isKiosk && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setCart(
            calculateCartTotals(parsed.items || [], parsed.orderType || "DELIVERY", {
              deliveryFee: defaultDeliveryFee,
              discountAmount: parsed.discountAmount || 0,
              tipAmount: parsed.tipAmount || 0,
            })
          );
        }
      } catch (e) {
        console.error("Failed to load cart from storage", e);
      }
      setIsHydrated(true);
    }
  }, [slug, isKiosk, defaultDeliveryFee, storageKey]);

  // Persist to localStorage for website
  useEffect(() => {
    if (isHydrated && !isKiosk && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(cart));
      } catch (e) {
        // ignore
      }
    }
  }, [cart, isHydrated, isKiosk, storageKey]);

  const recalculate = (
    newItems: CartItem[],
    orderType = cart.orderType,
    discountAmount = cart.discountAmount,
    tipAmount = cart.tipAmount
  ): Cart => {
    const updated = calculateCartTotals(newItems, orderType, {
      deliveryFee: isKiosk ? 0 : defaultDeliveryFee,
      discountAmount,
      tipAmount,
    });
    updated.couponCode = cart.couponCode;
    return updated;
  };

  const addItem = (input: {
    productId: string;
    name: string;
    basePrice: number;
    quantity: number;
    variantId?: string | null;
    selectedModifiers?: SelectedModifier[];
    notes?: string;
  }) => {
    const mods = input.selectedModifiers || [];
    const modTotal = mods.reduce((sum, m) => sum + (m.priceAdjustment || 0), 0);
    const itemTotal = Number(((input.basePrice + modTotal) * input.quantity).toFixed(2));

    const newItem: CartItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: input.productId,
      name: input.name,
      basePrice: input.basePrice,
      quantity: input.quantity,
      variantId: input.variantId || null,
      selectedModifiers: mods,
      notes: input.notes,
      itemTotal,
    };

    setCart((prev) => recalculate([...prev.items, newItem]));
    if (!isKiosk) {
      setIsDrawerOpen(true);
    }
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }
    setCart((prev) => {
      const newItems = prev.items.map((it) => (it.id === itemId ? { ...it, quantity: newQuantity } : it));
      return recalculate(newItems);
    });
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => {
      const newItems = prev.items.filter((it) => it.id !== itemId);
      return recalculate(newItems);
    });
  };

  const clearCart = () => {
    setCart({
      ...initialCart,
      orderType: isKiosk ? "DINE_IN" : "DELIVERY",
      deliveryFee: isKiosk ? 0 : defaultDeliveryFee,
    });
    if (!isKiosk && typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  };

  const setOrderType = (type: OrderType) => {
    setCart((prev) => recalculate(prev.items, type));
  };

  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string }> => {
    const codeUpper = code.trim().toUpperCase();
    if (codeUpper === "WELCOME10" || codeUpper === "SHORTECH10") {
      const discount = Number((cart.subtotal * 0.1).toFixed(2));
      setCart((prev) => {
        const next = recalculate(prev.items, prev.orderType, discount);
        next.couponCode = codeUpper;
        return next;
      });
      return { success: true, message: "הקופון הופעל! 10% הנחה נוספו להזמנה" };
    } else if (codeUpper === "BURGER20" || codeUpper === "VIP20") {
      const discount = 20.0;
      setCart((prev) => {
        const next = recalculate(prev.items, prev.orderType, discount);
        next.couponCode = codeUpper;
        return next;
      });
      return { success: true, message: "הקופון הופעל! ₪20 הנחה נוספו להזמנה" };
    } else {
      return { success: false, message: "קוד קופון אינו תקין או פג תוקף" };
    }
  };

  const removeCoupon = () => {
    setCart((prev) => {
      const next = recalculate(prev.items, prev.orderType, 0);
      next.couponCode = null;
      return next;
    });
  };

  const setTipAmount = (amount: number) => {
    setCart((prev) => recalculate(prev.items, prev.orderType, prev.discountAmount, amount));
  };

  const totalItemsCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        isDrawerOpen,
        totalItemsCount,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        setOrderType,
        applyCoupon,
        removeCoupon,
        setTipAmount,
        openDrawer: () => setIsDrawerOpen(true),
        closeDrawer: () => setIsDrawerOpen(false),
        toggleDrawer: () => setIsDrawerOpen((v) => !v),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
