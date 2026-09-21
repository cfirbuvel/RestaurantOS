/**
 * Canonical Universal Order Contracts
 */

import {
  OrderStatus,
  OrderChannel,
  OrderType,
  PaymentStatus,
  SelectedModifier,
  OrderItem,
  Order,
  VALID_ORDER_TRANSITIONS,
} from "@/modules/orders/domain/order";

export type {
  OrderStatus,
  OrderChannel,
  OrderType,
  PaymentStatus,
  SelectedModifier,
  OrderItem,
  Order,
};

export { VALID_ORDER_TRANSITIONS };

export interface CreateOrderItemInput {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  selectedModifiers?: Array<{
    modifierId: string;
    name: string;
    price: number;
  }>;
}

export interface CreateOrderPayload {
  branchId: string;
  channel: OrderChannel;
  orderType: OrderType;
  items: CreateOrderItemInput[];
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: {
    street: string;
    houseNumber: string;
    city: string;
    apartment?: string;
    floor?: string;
    entrance?: string;
    notes?: string;
    lat?: number;
    lng?: number;
  };
  notes?: string;
  kitchenNotes?: string;
  tipAmount?: number;
}

export interface OrderSummaryDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  channel: OrderChannel;
  totalAmount: number;
  currency: string;
  itemCount: number;
  itemsPreview: string[];
  createdAt: string;
  estimatedReadyAt?: string | null;
}
