import crypto from "crypto";
import { verifyWebhookSignature } from "@/core/security/webhook-verifier";
import { getRedisClient } from "@/core/cache/redis";
import { eventBus } from "@/core/events/event-bus";
import { memoryDb } from "@/core/database/db";
import { orderService } from "@/modules/orders/services/order-service";
import { customerService } from "@/modules/crm/services/customer-service";
import { menuService } from "@/modules/menu/services/menu-service";
import {
  UniversalExternalOrderDTO,
  UniversalExternalOrderSchema,
} from "../domain/canonical-dtos";
import { OrderChannel } from "@/modules/orders/domain/order";

export interface PipelineExecutionOptions {
  provider: "WOLT" | "TENBIS" | "MISHLOHA";
  rawBody: Buffer | string;
  headers: Record<string, string>;
  secret: string;
  tenantId: string;
  branchId: string;
  transform: (rawPayload: any) => UniversalExternalOrderDTO;
  bypassSignature?: boolean; // Useful for internal simulations
}

export interface PipelineResult {
  success: boolean;
  statusCode: number;
  duplicate?: boolean;
  orderId?: string;
  orderNumber?: string;
  reason?: string;
  canonicalOrder?: UniversalExternalOrderDTO;
}

export class IntegrationPipelineRunner {
  private static instance: IntegrationPipelineRunner;

  static getInstance(): IntegrationPipelineRunner {
    if (!IntegrationPipelineRunner.instance) {
      IntegrationPipelineRunner.instance = new IntegrationPipelineRunner();
    }
    return IntegrationPipelineRunner.instance;
  }

  /**
   * Execute the canonical 10-step Normalized Integration Pipeline
   */
  async processInboundOrder(options: PipelineExecutionOptions): Promise<PipelineResult> {
    const {
      provider,
      rawBody,
      headers,
      secret,
      tenantId,
      branchId,
      transform,
      bypassSignature = false,
    } = options;

    // ── STEP 1: Receive Webhook / Inbound Payload ────────────────────────────
    if (!rawBody) {
      return { success: false, statusCode: 400, reason: "Empty webhook payload" };
    }

    // ── STEP 2 & 3: Verify Cryptographic Signature & Timestamp Freshness ─────
    if (!bypassSignature) {
      // Provider brand names may differ from internal identifiers
      // (e.g. "10bis" vs "tenbis"), so we check multiple header prefixes.
      const PROVIDER_HEADER_PREFIXES: Record<string, string[]> = {
        WOLT: ["wolt"],
        TENBIS: ["tenbis", "10bis"],
        MISHLOHA: ["mishloha"],
      };

      const prefixes = PROVIDER_HEADER_PREFIXES[provider] || [provider.toLowerCase()];

      const findHeader = (suffix: string): string | undefined => {
        for (const prefix of prefixes) {
          const val = headers[`x-${prefix}-${suffix}`];
          if (val) return val;
        }
        return undefined;
      };

      const signatureHeader =
        headers["x-webhook-signature"] ||
        findHeader("signature") ||
        headers["x-signature"] ||
        "";

      const timestampHeader =
        headers["x-webhook-timestamp"] ||
        findHeader("timestamp") ||
        headers["x-timestamp"];

      const timestamp = timestampHeader ? parseInt(timestampHeader, 10) : undefined;

      const verification = verifyWebhookSignature({
        body: rawBody,
        signature: signatureHeader,
        secret,
        timestamp,
        toleranceSeconds: 300, // 5-minute replay attack tolerance (Phase 00 §36)
        provider,
      });

      if (!verification.valid) {
        return {
          success: false,
          statusCode: 401,
          reason: verification.reason || "Signature verification failed",
        };
      }
    }

    // Parse JSON body for subsequent steps
    let parsedBody: any;
    try {
      const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
      parsedBody = JSON.parse(bodyStr);
    } catch {
      return { success: false, statusCode: 400, reason: "Malformed JSON payload" };
    }

    // ── STEP 4: Check Idempotency Key / Redis Lock ───────────────────────────
    const eventId =
      headers["x-event-id"] ||
      headers["x-idempotency-key"] ||
      parsedBody.event_id ||
      parsedBody.order_id ||
      parsedBody.id ||
      parsedBody.order?.id ||
      parsedBody.Order?.OrderNumber ||
      parsedBody.Order?.OrderId ||
      parsedBody.mishlohaOrder?.orderId;

    if (!eventId) {
      return { success: false, statusCode: 400, reason: "Missing event/order identifier for idempotency" };
    }

    const redis = getRedisClient();
    const idempotencyKey = `idempotency:webhook:${provider.toLowerCase()}:${eventId}`;
    const cached = await redis.get(idempotencyKey);
    if (cached) {
      const cachedResult = JSON.parse(cached);
      return {
        success: true,
        statusCode: 200,
        duplicate: true,
        orderId: cachedResult.orderId,
        orderNumber: cachedResult.orderNumber,
        reason: "Duplicate event suppressed by idempotency cache",
      };
    }

    // Distributed lock to prevent concurrent race conditions
    const lockKey = `lock:webhook:${provider.toLowerCase()}:${eventId}`;
    const lockAcquired = await redis.set(lockKey, "LOCKED", "PX", 10000); // 10s auto-release lock
    if (!lockAcquired) {
      return {
        success: false,
        statusCode: 429,
        reason: "Concurrent webhook execution in progress; please retry shortly",
      };
    }

    try {
      // ── STEP 5: Transform External Format ──────────────────────────────────
      let transformed: UniversalExternalOrderDTO;
      try {
        transformed = transform(parsedBody);
        transformed.tenantId = tenantId;
        transformed.branchId = branchId;
      } catch (err: any) {
        return {
          success: false,
          statusCode: 422,
          reason: `Adapter transformation failed: ${err.message}`,
        };
      }

      // ── STEP 6 & 7: Universal Canonical DTO & Zod Schema Validation ─────────
      const validation = UniversalExternalOrderSchema.safeParse(transformed);
      if (!validation.success) {
        return {
          success: false,
          statusCode: 400,
          reason: `Canonical validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`,
        };
      }
      const canonicalOrder = validation.data;

      // ── STEP 8: Persist to DB / OrderService ────────────────────────────────
      // Resolve or auto-create customer in CRM
      let customerId: string | null = null;
      try {
        const existingCustomer = await customerService.findByPhone(
          tenantId,
          canonicalOrder.customer.phone
        );
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const names = canonicalOrder.customer.name.split(" ");
          const firstName = names[0] || "Aggregator";
          const lastName = names.slice(1).join(" ") || "Customer";
          const newCustomer = await customerService.createCustomer(tenantId, {
            phone: canonicalOrder.customer.phone,
            email: canonicalOrder.customer.email,
            firstName,
            lastName,
            internalNotes: `Auto-created from ${provider} order ${canonicalOrder.externalOrderId}`,
          });
          customerId = newCustomer.id;
        }
      } catch {
        // Continue even if customer profile lookup fails
      }

      // Resolve items against menu catalog or auto-create integration product
      const orderItems = await this.resolveOrderItems(tenantId, branchId, canonicalOrder.items);

      // Ingest order via OrderService
      const channel: OrderChannel =
        provider === "WOLT" ? "WOLT" : provider === "TENBIS" ? "TENBIS" : "MISHLOHA";

      const createdOrder = await orderService.createOrder({
        tenantId,
        branchId,
        customerId,
        channel,
        orderType: canonicalOrder.fulfillmentType === "DELIVERY" ? "DELIVERY" : "TAKEAWAY",
        items: orderItems,
        discountAmount: canonicalOrder.financials.discountAmount,
        deliveryFee: canonicalOrder.financials.deliveryFee,
        tipAmount: canonicalOrder.financials.tipAmount,
        notes: canonicalOrder.deliveryNotes,
        kitchenNotes: canonicalOrder.kitchenNotes,
        externalOrderId: canonicalOrder.externalOrderId,
        autoConfirm: true,
        actorId: `integration:${provider.toLowerCase()}`,
        actorType: "INTEGRATION",
        metadata: {
          ...canonicalOrder.rawMetadata,
          provider,
          externalOrderId: canonicalOrder.externalOrderId,
        },
      });

      // ── STEP 9: Transactional Outbox & Publish Domain Event ──────────────────
      await eventBus.publish({
        tenantId,
        branchId,
        eventType: "OrderCreated",
        correlationId: crypto.randomUUID(),
        actor: {
          actorId: `integration:${provider.toLowerCase()}`,
          actorType: "INTEGRATION",
        },
        payload: {
          orderId: createdOrder.id,
          orderNumber: createdOrder.order_number,
          channel: createdOrder.channel,
          status: createdOrder.status,
          externalOrderId: canonicalOrder.externalOrderId,
          totalAmount: createdOrder.total_amount,
        },
      });

      // ── STEP 10: Realtime Dispatch & Cache Idempotency Result ───────────────
      const resultData = {
        orderId: createdOrder.id,
        orderNumber: createdOrder.order_number,
      };

      // Store in idempotency cache with 24-hour expiration (86400s)
      await redis.set(idempotencyKey, JSON.stringify(resultData), "EX", 86400);

      // Audit integration log
      try {
        memoryDb.insert("integration_logs", {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          provider,
          event_type: "ORDER_INGESTED",
          status: "SUCCESS",
          details: {
            orderId: createdOrder.id,
            externalOrderId: canonicalOrder.externalOrderId,
            amount: createdOrder.total_amount,
          },
          created_at: new Date().toISOString(),
        });
      } catch {
        // ignore
      }

      return {
        success: true,
        statusCode: 200,
        orderId: createdOrder.id,
        orderNumber: createdOrder.order_number,
        canonicalOrder,
      };
    } finally {
      // Release distributed lock
      await redis.del(lockKey);
    }
  }

  /**
   * Helper to ensure line items can be calculated by MenuService
   */
  private async resolveOrderItems(
    tenantId: string,
    branchId: string,
    items: UniversalExternalOrderDTO["items"]
  ): Promise<Array<{ productId: string; variantId?: string | null; quantity: number; notes?: string }>> {
    const resolved: Array<{ productId: string; variantId?: string | null; quantity: number; notes?: string }> = [];

    // Ensure there is at least an integration fallback product if an external item has no product ID
    let fallbackProductId: string | null = null;

    for (const item of items) {
      let productId = item.sku || item.externalItemId;

      // Check if product exists in menu
      let productExists = false;
      if (productId) {
        try {
          const prod = await menuService.getProduct(tenantId, productId, branchId);
          if (prod && prod.is_active) productExists = true;
        } catch {
          productExists = false;
        }
      }

      if (!productExists) {
        // Use or create fallback integration product
        if (!fallbackProductId) {
          fallbackProductId = await this.getOrCreateIntegrationProduct(tenantId, branchId);
        }
        productId = fallbackProductId;
      }

      resolved.push({
        productId: productId!,
        quantity: item.quantity,
        notes: item.notes || item.name,
      });
    }

    return resolved;
  }

  private async getOrCreateIntegrationProduct(tenantId: string, branchId: string): Promise<string> {
    const existing = memoryDb.find(
      "products",
      (p: any) => p.tenant_id === tenantId && p.sku === "INTEGRATION-GENERIC"
    );
    if (existing.length > 0) {
      return existing[0].id;
    }

    // Find or create category
    let category = memoryDb.find("categories", (c: any) => c.tenant_id === tenantId)[0];
    if (!category) {
      category = await menuService.createCategory(tenantId, {
        name: "אינטגרציות (Integrations)",
        isActive: true,
      });
    }

    const product = await menuService.createProduct(tenantId, {
      categoryId: category.id,
      name: "פריט הזמנה חיצונית (External Item)",
      basePrice: 10,
      isActive: true,
    });

    // Update SKU for future matches
    const prodRecord = memoryDb.getTable("products").get(product.id);
    if (prodRecord) {
      prodRecord.sku = "INTEGRATION-GENERIC";
    }

    return product.id;
  }
}

export const integrationPipelineRunner = IntegrationPipelineRunner.getInstance();
