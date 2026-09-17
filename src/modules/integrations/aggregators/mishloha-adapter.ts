import crypto from "crypto";
import { IAggregatorAdapter } from "./aggregator-adapter";
import { UniversalExternalOrderDTO } from "../domain/canonical-dtos";
import { OrderStatus } from "@/modules/orders/domain/order";
import { verifyWebhookSignature } from "@/core/security/webhook-verifier";

export class MishlohaAdapter implements IAggregatorAdapter {
  readonly providerName = "MISHLOHA" as const;

  constructor(
    protected apiKey: string = process.env.MISHLOHA_API_KEY || "mock-mishloha-key",
    protected secret: string = process.env.MISHLOHA_WEBHOOK_SECRET || "mock-mishloha-secret"
  ) {}

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>, secret?: string): boolean {
    const sig = headers["x-mishloha-signature"] || headers["x-signature"] || "";
    const ts = headers["x-mishloha-timestamp"] || headers["x-timestamp"];
    const timestamp = ts ? parseInt(ts, 10) : undefined;
    const res = verifyWebhookSignature({
      body: rawBody,
      signature: sig,
      secret: secret || this.secret,
      timestamp,
      toleranceSeconds: 300,
      provider: "Mishloha",
    });
    return res.valid;
  }

  transformToCanonicalOrder(rawPayload: any): UniversalExternalOrderDTO {
    const order = rawPayload.mishlohaOrder || rawPayload.order || rawPayload;
    const orderId = order.orderId || order.id;
    if (!orderId) {
      throw new Error("Mishloha payload missing orderId");
    }

    const items = (order.orderItems || order.items || []).map((item: any) => ({
      externalItemId: (item.itemId || item.id || "").toString(),
      sku: (item.sku || item.itemId || "").toString(),
      name: item.itemName || item.name || "Mishloha Dish",
      quantity: Number(item.quantity || 1),
      unitPrice: Number((item.price || item.unitPrice || 0).toFixed(2)),
      totalPrice: Number(((item.price || 0) * (item.quantity || 1)).toFixed(2)),
      notes: item.comments || item.notes,
      selectedModifiers: (item.extras || item.modifiers || []).map((ext: any) => ({
        externalModifierId: (ext.id || "").toString(),
        name: ext.name,
        price: Number((ext.price || 0).toFixed(2)),
      })),
    }));

    const totalAmount = Number((order.orderTotal || order.total || 0).toFixed(2));
    const deliveryFee = Number((order.deliveryPrice || order.deliveryFee || 0).toFixed(2));
    const subtotal = Math.max(0, Number((totalAmount - deliveryFee).toFixed(2)));

    const cust = order.customer || {};
    const addr = cust.address || order.address;
    const address = addr
      ? {
          street: addr.street || "Street",
          streetNumber: addr.houseNumber || addr.number,
          city: addr.city || "Tel Aviv",
          apartment: addr.apartment,
          floor: addr.floor,
          entryCode: addr.code,
          deliveryInstructions: addr.notes || order.deliveryNotes,
        }
      : undefined;

    return {
      provider: "MISHLOHA",
      externalOrderId: orderId.toString(),
      tenantId: rawPayload.tenantId || "1b9ca808-44c7-4fec-b94f-05c133c959f0",
      branchId: rawPayload.branchId || "be7c3e30-b28b-4d23-9d78-b56b545351f5",
      customer: {
        name: cust.fullName || cust.name || "Mishloha Customer",
        phone: cust.phone || cust.phoneNumber || "050-9876543",
        email: cust.email,
        address,
      },
      items,
      financials: {
        subtotal,
        taxAmount: Number((subtotal * 0.17).toFixed(2)),
        deliveryFee,
        tipAmount: Number((order.tip || 0).toFixed(2)),
        discountAmount: Number((order.discount || 0).toFixed(2)),
        totalAmount,
        currency: "ILS",
      },
      fulfillmentType: order.deliveryType === "TAKEAWAY" ? "PICKUP" : "DELIVERY",
      deliveryNotes: order.deliveryNotes,
      kitchenNotes: order.kitchenNotes,
      rawMetadata: {
        mishlohaOrderId: orderId,
        restaurantId: order.restaurantId,
      },
    };
  }

  async sendOrderStatusUpdate(
    externalOrderId: string,
    status: OrderStatus,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }
}

export class MockMishlohaAdapter extends MishlohaAdapter {
  public statusUpdatesSent: Array<{ externalOrderId: string; status: OrderStatus; reason?: string }> = [];

  async sendOrderStatusUpdate(
    externalOrderId: string,
    status: OrderStatus,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    this.statusUpdatesSent.push({ externalOrderId, status, reason });
    return { success: true };
  }

  signPayload(payload: string | Buffer, secret: string = this.secret): string {
    const raw = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
    return "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  }
}
