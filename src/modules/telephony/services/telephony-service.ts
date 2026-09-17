import crypto from "crypto";
import { memoryDb, getPostgresPool } from "@/core/database/db";
import { eventBus } from "@/core/events/event-bus";
import { customerService } from "@/modules/crm/services/customer-service";
import { orderService } from "@/modules/orders/services/order-service";
import { ITelephonyAdapter, MockSIPAdapter } from "../adapters/mock-sip-adapter";
import {
  CallLog,
  CallStatus,
  CallDirection,
  CallerIdPayload,
  CallerIdCustomerSummary,
  WebhookIncomingCallPayload,
  WebhookCallStatusPayload,
  normalizePhoneNumber,
} from "../domain/telephony";

export interface TelephonyServiceOptions {
  adapter?: ITelephonyAdapter;
}

export class TelephonyService {
  private adapter: ITelephonyAdapter;

  constructor(options?: TelephonyServiceOptions) {
    this.adapter = options?.adapter || new MockSIPAdapter();
  }

  getAdapter(): ITelephonyAdapter {
    return this.adapter;
  }

  setAdapter(adapter: ITelephonyAdapter) {
    this.adapter = adapter;
  }

  /**
   * Handle incoming ringing call from PBX/SIP
   * Normalizes caller number, performs CRM customer lookup, builds caller ID payload,
   * logs call session, and publishes call.ringing domain event.
   */
  async handleIncomingCall(
    tenantId: string,
    rawPayload: any,
    options?: { branchId?: string }
  ): Promise<{ callLog: CallLog; callerId: CallerIdPayload }> {
    const parsed = this.adapter.parseIncomingCallPayload(rawPayload);
    const branchId = options?.branchId || parsed.branchId || null;

    // 1. Normalize phone
    const { normalizedLocal, e164 } = normalizePhoneNumber(parsed.callerNumber);
    const effectivePhone = normalizedLocal || parsed.callerNumber;

    // 2. Lookup Customer in CRM
    let customer = await customerService.findByPhone(tenantId, effectivePhone);
    if (!customer && e164) {
      customer = await customerService.findByPhone(tenantId, e164);
    }

    // 3. Gather Recent Orders & Addresses if customer exists
    let recentOrders: CallerIdPayload["recentOrders"] = [];
    let savedAddresses: CallerIdPayload["savedAddresses"] = [];
    let customerSummary: CallerIdCustomerSummary | null = null;

    if (customer) {
      customerSummary = {
        id: customer.id,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        email: customer.email,
        isVip: customer.is_vip,
        totalOrdersCount: customer.total_orders_count || 0,
        totalSpentAmount: Number(customer.total_spent_amount || 0),
        averageOrderValue: Number(customer.average_order_value || 0),
        lastOrderAt: customer.last_order_at,
        allergies: customer.allergies || [],
        preferences: customer.preferences || {},
        internalNotes: customer.internal_notes,
      };

      try {
        const orders = await orderService.listOrders(tenantId, {
          customerId: customer.id,
          limit: 5,
        });
        recentOrders = orders.map((o) => ({
          id: o.id,
          orderNumber: o.order_number || o.id.slice(0, 8),
          status: o.status,
          totalAmount: Number(o.total_amount),
          createdAt: o.created_at,
          itemCount: o.items?.length || 0,
        }));
      } catch (err) {
        // Soft-fail recent orders lookup if orders module is empty/failing
        recentOrders = [];
      }

      try {
        const addresses = await customerService.getAddresses(tenantId, customer.id);
        savedAddresses = addresses.map((a) => ({
          id: a.id,
          street: a.street,
          houseNumber: a.house_number,
          city: a.city,
          entrance: a.entrance,
          floor: a.floor,
          apartment: a.apartment,
          isDefault: a.is_default,
        }));
      } catch (err) {
        savedAddresses = [];
      }
    }

    const ringTimestamp = parsed.timestamp || new Date().toISOString();

    // 4. Build Caller ID Payload
    const callerId: CallerIdPayload = {
      callSessionId: parsed.sessionId,
      callerNumber: effectivePhone,
      callerNumberRaw: parsed.callerNumber,
      direction: parsed.direction || "INBOUND",
      status: "RINGING",
      branchId,
      customer: customerSummary,
      recentOrders,
      savedAddresses,
      ringTimestamp,
    };

    // 5. Create or Idempotently Retrieve Call Log
    const existingLog = await this.getCallLogBySessionId(tenantId, parsed.sessionId);
    let callLog: CallLog;

    if (existingLog) {
      callLog = existingLog;
    } else {
      const newCallLog: CallLog = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        branch_id: branchId,
        call_session_id: parsed.sessionId,
        caller_number: effectivePhone,
        caller_number_raw: parsed.callerNumber,
        direction: parsed.direction || "INBOUND",
        status: "RINGING",
        customer_id: customer ? customer.id : null,
        operator_id: null,
        duration_seconds: 0,
        started_at: ringTimestamp,
        answered_at: null,
        ended_at: null,
        recording_url: null,
        // Phase 7 user clarification: Israeli law needs pre-loaded greeting played in first seconds
        automated_greeting_played: true,
        metadata: parsed.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await this.saveCallLog(newCallLog);
      callLog = newCallLog;

      // 6. Emit typed domain event & outbox event
      await eventBus.publish({
        eventType: "call.ringing",
        tenantId,
        branchId: branchId || undefined,
        correlationId: parsed.sessionId,
        actor: {
          actorId: "TELEPHONY_PBX",
          actorType: "INTEGRATION",
        },
        payload: callerId,
      });
    }

    return { callLog, callerId };
  }

  /**
   * Handle status updates from PBX (answered, ended, missed, rejected)
   */
  async handleCallStatusUpdate(
    tenantId: string,
    rawPayload: any
  ): Promise<CallLog | null> {
    const parsed = this.adapter.parseStatusPayload(rawPayload);
    const existing = await this.getCallLogBySessionId(tenantId, parsed.sessionId);

    if (!existing) {
      return null;
    }

    const patch: Partial<CallLog> = {
      status: parsed.status,
      updated_at: new Date().toISOString(),
    };

    if (parsed.status === "ANSWERED") {
      patch.answered_at = parsed.timestamp || new Date().toISOString();
      if (parsed.operatorId) {
        patch.operator_id = parsed.operatorId;
      }
    } else if (["COMPLETED", "MISSED", "REJECTED"].includes(parsed.status)) {
      patch.ended_at = parsed.timestamp || new Date().toISOString();
      if (parsed.durationSeconds !== undefined) {
        patch.duration_seconds = parsed.durationSeconds;
      }
      if (parsed.recordingUrl) {
        patch.recording_url = parsed.recordingUrl;
      }
      if (parsed.operatorId && !existing.operator_id) {
        patch.operator_id = parsed.operatorId;
      }
    }

    const updated = await this.updateCallLog(tenantId, existing.id, patch);

    // Emit event depending on status
    const eventType =
      parsed.status === "ANSWERED"
        ? "call.answered"
        : ["COMPLETED", "MISSED", "REJECTED"].includes(parsed.status)
        ? "call.ended"
        : `call.${parsed.status.toLowerCase()}`;

    await eventBus.publish({
      eventType,
      tenantId,
      branchId: updated.branch_id || undefined,
      correlationId: updated.call_session_id,
      actor: {
        actorId: updated.operator_id || "TELEPHONY_PBX",
        actorType: updated.operator_id ? "USER" : "INTEGRATION",
      },
      payload: updated,
    });

    return updated;
  }

  /**
   * Query call logs
   */
  async getCallLogs(
    tenantId: string,
    filters?: {
      branchId?: string;
      status?: CallStatus;
      customerId?: string;
      limit?: number;
    }
  ): Promise<CallLog[]> {
    const limit = filters?.limit || 50;

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      let logs = memoryDb.find("call_logs", (c: any) => c.tenant_id === tenantId);

      if (filters?.branchId) {
        logs = logs.filter((c: any) => c.branch_id === filters.branchId);
      }
      if (filters?.status) {
        logs = logs.filter((c: any) => c.status === filters.status);
      }
      if (filters?.customerId) {
        logs = logs.filter((c: any) => c.customer_id === filters.customerId);
      }

      // Sort desc by started_at
      logs.sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
      return logs.slice(0, limit) as CallLog[];
    }

    const pool = getPostgresPool();
    let query = "SELECT * FROM call_logs WHERE tenant_id = $1";
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters?.branchId) {
      query += ` AND branch_id = $${idx++}`;
      params.push(filters.branchId);
    }
    if (filters?.status) {
      query += ` AND status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters?.customerId) {
      query += ` AND customer_id = $${idx++}`;
      params.push(filters.customerId);
    }

    query += ` ORDER BY started_at DESC LIMIT $${idx}`;
    params.push(limit);

    const res = await pool.query(query, params);
    return res.rows as CallLog[];
  }

  /**
   * Get call log by ID
   */
  async getCallLogById(tenantId: string, id: string): Promise<CallLog | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const found = memoryDb.find("call_logs", (c: any) => c.id === id && c.tenant_id === tenantId);
      return found.length > 0 ? (found[0] as CallLog) : null;
    }

    const pool = getPostgresPool();
    const res = await pool.query("SELECT * FROM call_logs WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
    return res.rows.length > 0 ? (res.rows[0] as CallLog) : null;
  }

  /**
   * Get call log by session ID (idempotency support)
   */
  async getCallLogBySessionId(tenantId: string, sessionId: string): Promise<CallLog | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const found = memoryDb.find(
        "call_logs",
        (c: any) => c.call_session_id === sessionId && c.tenant_id === tenantId
      );
      return found.length > 0 ? (found[0] as CallLog) : null;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      "SELECT * FROM call_logs WHERE call_session_id = $1 AND tenant_id = $2",
      [sessionId, tenantId]
    );
    return res.rows.length > 0 ? (res.rows[0] as CallLog) : null;
  }

  // ── Persistence Helpers ───────────────────────────────────────────────────

  private async saveCallLog(callLog: CallLog): Promise<void> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("call_logs", callLog);
      return;
    }

    const pool = getPostgresPool();
    await pool.query(
      `INSERT INTO call_logs (
        id, tenant_id, branch_id, call_session_id, caller_number, caller_number_raw,
        direction, status, customer_id, operator_id, duration_seconds,
        started_at, answered_at, ended_at, recording_url, automated_greeting_played,
        metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )`,
      [
        callLog.id,
        callLog.tenant_id,
        callLog.branch_id || null,
        callLog.call_session_id,
        callLog.caller_number,
        callLog.caller_number_raw || null,
        callLog.direction,
        callLog.status,
        callLog.customer_id || null,
        callLog.operator_id || null,
        callLog.duration_seconds,
        callLog.started_at,
        callLog.answered_at || null,
        callLog.ended_at || null,
        callLog.recording_url || null,
        callLog.automated_greeting_played,
        JSON.stringify(callLog.metadata || {}),
        callLog.created_at,
        callLog.updated_at,
      ]
    );
  }

  private async updateCallLog(tenantId: string, id: string, patch: Partial<CallLog>): Promise<CallLog> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const updated = memoryDb.update("call_logs", id, patch);
      return updated as CallLog;
    }

    const pool = getPostgresPool();
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(patch)) {
      setClauses.push(`${k} = $${idx++}`);
      values.push(k === "metadata" ? JSON.stringify(v) : v);
    }

    values.push(id, tenantId);
    const query = `UPDATE call_logs SET ${setClauses.join(", ")} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`;
    const res = await pool.query(query, values);
    return res.rows[0] as CallLog;
  }
}

export const telephonyService = new TelephonyService();
