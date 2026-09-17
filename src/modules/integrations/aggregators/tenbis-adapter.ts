import crypto from "crypto";
import { IAggregatorAdapter } from "./aggregator-adapter";
import { UniversalExternalOrderDTO } from "../domain/canonical-dtos";
import { OrderStatus } from "@/modules/orders/domain/order";
import { verifyWebhookSignature } from "@/core/security/webhook-verifier";

export class TenBisAdapter implements IAggregatorAdapter {
  readonly providerName = "TENBIS" as const;

  constructor(
    protected apiKey: string = process.env.TENBIS_API_KEY || "mock-tenbis-key",
    protected secret: string = process.env.TENBIS_WEBHOOK_SECRET || "mock-tenbis-secret"
  ) {}

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>, secret?: string): boolean {
    const sig = headers["x-10bis-signature"] || headers["x-tenbis-signature"] || headers["x-signature"] || "";
    const ts = headers["x-10bis-timestamp"] || headers["x-timestamp"];
    const timestamp = ts ? parseInt(ts, 10) : undefined;
    const res = verifyWebhookSignature({
      body: rawBody,
      signature: sig,
      secret: secret || this.secret,
      timestamp,
      toleranceSeconds: 300,
      provider: "10bis",
    });
    return res.valid;
  }

  transformToCanonicalOrder(rawPayload: any): UniversalExternalOrderDTO {
    const order = rawPayload.Order || rawPayload.order || rawPayload;
    const orderId = order.OrderNumber || order.OrderId || order.id;
    if (!orderId) {
      throw new Error("10bis payload missing OrderNumber");
    }

    const items = (order.Items || order.items || []).map((item: any) => ({
      externalItemId: (item.ItemId || item.id || "").toString(),
      sku: (item.DishCode || item.sku || item.ItemId || "").toString(),
      name: item.DishName || item.name || "10bis Dish",
      quantity: Number(item.Quantity || item.quantity || 1),
      unitPrice: Number((item.Price || item.unitPrice || 0).toFixed(2)),
      totalPrice: Number(((item.Price || 0) * (item.Quantity || 1)).toFixed(2)),
      notes: item.Remarks || item.notes,
      selectedModifiers: (item.Modifiers || item.options || []).map((m: any) => ({
        externalModifierId: (m.Id || m.id || "").toString(),
        name: m.Name || m.name,
        price: Number((m.Price || 0).toFixed(2)),
      })),
    }));

    const totalAmount = Number((order.TotalAmount || order.total || 0).toFixed(2));
    const deliveryFee = Number((order.DeliveryFee || 0).toFixed(2));
    const subtotal = Math.max(0, Number((totalAmount - deliveryFee).toFixed(2)));

    const address = order.DeliveryAddress || order.address
      ? {
          street: order.DeliveryAddress?.Street || order.address?.street || "Street",
          streetNumber: order.DeliveryAddress?.HouseNumber || order.address?.number,
          city: order.DeliveryAddress?.City || order.address?.city || "Tel Aviv",
          apartment: order.DeliveryAddress?.Apartment || order.address?.apt,
          floor: order.DeliveryAddress?.Floor || order.address?.floor,
          entryCode: order.DeliveryAddress?.EntryCode || order.address?.entryCode,
          deliveryInstructions: order.DeliveryAddress?.Remarks || order.Remarks,
        }
      : undefined;

    return {
      provider: "TENBIS",
      externalOrderId: orderId.toString(),
      tenantId: rawPayload.tenantId || "1b9ca808-44c7-4fec-b94f-05c133c959f0",
      branchId: rawPayload.branchId || "be7c3e30-b28b-4d23-9d78-b56b545351f5",
      customer: {
        name: order.CustomerName || order.customer?.name || "10bis Diner",
        phone: order.PhoneNumber || order.customer?.phone || "050-1010101",
        email: order.Email || order.customer?.email,
        address,
      },
      items,
      financials: {
        subtotal,
        taxAmount: Number((subtotal * 0.17).toFixed(2)),
        deliveryFee,
        tipAmount: 0,
        discountAmount: 0,
        totalAmount,
        currency: "ILS",
      },
      fulfillmentType: order.IsTakeaway ? "PICKUP" : "DELIVERY",
      deliveryNotes: order.DeliveryRemarks || order.Remarks,
      kitchenNotes: order.KitchenRemarks,
      rawMetadata: {
        tenbisResId: order.ResId,
        companyName: order.CompanyName,
        orderId,
      },
    };
  }

  async sendOrderStatusUpdate(
    externalOrderId: string,
    status: OrderStatus,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    // 10bis status codes: 1=Received, 2=In Preparation, 3=Ready, 4=Completed, 5=Rejected
    return { success: true };
  }
}

export class MockTenBisAdapter extends TenBisAdapter {
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
