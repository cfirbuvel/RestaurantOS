import crypto from "crypto";
import { IAggregatorAdapter } from "./aggregator-adapter";
import { UniversalExternalOrderDTO } from "../domain/canonical-dtos";
import { OrderStatus } from "@/modules/orders/domain/order";
import { verifyWebhookSignature } from "@/core/security/webhook-verifier";

export class WoltAdapter implements IAggregatorAdapter {
  readonly providerName = "WOLT" as const;

  constructor(
    protected apiKey: string = process.env.WOLT_API_KEY || "mock-wolt-key",
    protected secret: string = process.env.WOLT_WEBHOOK_SECRET || "mock-wolt-secret"
  ) {}

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>, secret?: string): boolean {
    const sig = headers["x-wolt-signature"] || headers["x-signature"] || "";
    const ts = headers["x-wolt-timestamp"] || headers["x-timestamp"];
    const timestamp = ts ? parseInt(ts, 10) : undefined;
    const res = verifyWebhookSignature({
      body: rawBody,
      signature: sig,
      secret: secret || this.secret,
      timestamp,
      toleranceSeconds: 300,
      provider: "Wolt",
    });
    return res.valid;
  }

  transformToCanonicalOrder(rawPayload: any): UniversalExternalOrderDTO {
    const order = rawPayload.order || rawPayload;
    if (!order.id) {
      throw new Error("Wolt order payload missing id");
    }

    const items = (order.items || []).map((item: any) => ({
      externalItemId: item.id?.toString(),
      sku: item.sku || item.item_id || item.id?.toString(),
      name: item.name || "Wolt Item",
      quantity: Number(item.count || item.quantity || 1),
      unitPrice: Number(((item.base_price || item.unit_price || 0) / (item.base_price > 1000 ? 100 : 1)).toFixed(2)),
      totalPrice: Number(((item.total_price || item.price || 0) / (item.total_price > 1000 ? 100 : 1)).toFixed(2)),
      notes: item.comment || item.notes,
      selectedModifiers: (item.options || item.modifiers || []).map((opt: any) => ({
        externalModifierId: opt.id?.toString(),
        name: opt.name || opt.value,
        price: Number(((opt.price || 0) / (opt.price > 100 ? 100 : 1)).toFixed(2)),
      })),
    }));

    // Financial calculations
    const rawTotal = order.price?.amount ?? order.total_price ?? 0;
    const totalAmount = Number((rawTotal > 1000 ? rawTotal / 100 : rawTotal).toFixed(2));
    const rawFee = order.delivery_fee?.amount ?? order.delivery_fee ?? 0;
    const deliveryFee = Number((rawFee > 100 ? rawFee / 100 : rawFee).toFixed(2));
    const rawTip = order.tip?.amount ?? order.tip ?? 0;
    const tipAmount = Number((rawTip > 100 ? rawTip / 100 : rawTip).toFixed(2));
    const subtotal = Math.max(0, Number((totalAmount - deliveryFee - tipAmount).toFixed(2)));

    const address = order.delivery?.location
      ? {
          street: order.delivery.location.street_address || "Street",
          city: order.delivery.location.city || "Tel Aviv",
          apartment: order.delivery.location.apartment,
          latitude: order.delivery.location.coordinates?.[1],
          longitude: order.delivery.location.coordinates?.[0],
          deliveryInstructions: order.delivery.instructions,
        }
      : undefined;

    return {
      provider: "WOLT",
      externalOrderId: order.id.toString(),
      tenantId: rawPayload.tenantId || "1b9ca808-44c7-4fec-b94f-05c133c959f0",
      branchId: rawPayload.branchId || "be7c3e30-b28b-4d23-9d78-b56b545351f5",
      customer: {
        name: order.customer?.name || "Wolt Customer",
        phone: order.customer?.phone_number || order.customer?.phone || "050-0000000",
        email: order.customer?.email,
        address,
      },
      items,
      financials: {
        subtotal,
        taxAmount: Number((subtotal * 0.17).toFixed(2)),
        deliveryFee,
        tipAmount,
        discountAmount: 0,
        totalAmount,
        currency: order.price?.currency || "ILS",
      },
      fulfillmentType: order.delivery?.type === "homedelivery" || !order.delivery ? "DELIVERY" : "PICKUP",
      estimatedReadyTime: order.estimated_ready_time ? new Date(order.estimated_ready_time) : undefined,
      deliveryNotes: order.delivery?.instructions,
      kitchenNotes: order.kitchen_notes || order.comment,
      rawMetadata: {
        woltVenueId: order.venue_id,
        woltOrderId: order.id,
      },
    };
  }

  async sendOrderStatusUpdate(
    externalOrderId: string,
    status: OrderStatus,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    // Map RestaurantOS status to Wolt status
    const woltStatusMap: Record<OrderStatus, string> = {
      DRAFT: "received",
      CONFIRMED: "received",
      ACCEPTED: "accepted",
      IN_PREPARATION: "in_preparation",
      READY: "ready_for_pickup",
      COMPLETED: "delivered",
      CANCELLED: "rejected",
      FAILED: "rejected",
    };

    const targetStatus = woltStatusMap[status] || "received";

    // In production, dispatch HTTP POST to Wolt Merchant API
    if (process.env.NODE_ENV === "production" && process.env.WOLT_API_URL) {
      try {
        const res = await fetch(`${process.env.WOLT_API_URL}/venues/orders/${externalOrderId}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ status: targetStatus, reason }),
        });
        if (!res.ok) {
          return { success: false, error: `Wolt API HTTP ${res.status}` };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: true };
  }
}

export class MockWoltAdapter extends WoltAdapter {
  public statusUpdatesSent: Array<{ externalOrderId: string; status: OrderStatus; reason?: string }> = [];
  public shouldFailStatusUpdate: boolean = false;

  async sendOrderStatusUpdate(
    externalOrderId: string,
    status: OrderStatus,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (this.shouldFailStatusUpdate) {
      return { success: false, error: "Simulated Wolt status update timeout" };
    }
    this.statusUpdatesSent.push({ externalOrderId, status, reason });
    return { success: true };
  }

  /**
   * Helper to sign a test payload with HMAC-SHA256
   */
  signPayload(payload: string | Buffer, secret: string = this.secret): string {
    const raw = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
    return "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  }
}
