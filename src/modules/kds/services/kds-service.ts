import crypto from "crypto";
import { memoryDb, getPostgresPool } from "@/core/database/db";
import { eventBus } from "@/core/events/event-bus";
import {
  KDSStation,
  KDSTicket,
  KDSTicketItem,
  KDSTicketStatus,
  KDSTicketPriority,
  ProductStationAssignment,
  canTransitionKDSTicket,
  computeKDSSLA,
} from "../domain/kds";
import { Order, OrderItem } from "@/modules/orders/domain/order";

export class KDSService {
  // ── Station Configuration ──────────────────────────────────────────────────

  async getStationsForBranch(tenantId: string, branchId: string): Promise<KDSStation[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find(
        "kds_stations",
        (s: any) => s.tenant_id === tenantId && s.branch_id === branchId && s.is_active !== false
      ) as KDSStation[];
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT * FROM kds_stations WHERE tenant_id = $1 AND branch_id = $2 AND is_active = true ORDER BY name ASC`,
        [tenantId, branchId]
      );
      return res.rows as KDSStation[];
    }
  }

  async getStationById(tenantId: string, stationId: string): Promise<KDSStation | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const station = memoryDb.findById("kds_stations", stationId);
      if (!station || station.tenant_id !== tenantId) return null;
      return station as KDSStation;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT * FROM kds_stations WHERE id = $1 AND tenant_id = $2`,
        [stationId, tenantId]
      );
      return res.rows[0] || null;
    }
  }

  async createStation(
    tenantId: string,
    branchId: string,
    data: { name: string; displayName: string; stationType?: "KITCHEN" | "EXPO" | "DRIVE_THRU"; isActive?: boolean }
  ): Promise<KDSStation> {
    const stationData = {
      tenant_id: tenantId,
      branch_id: branchId,
      name: data.name.trim().toLowerCase(),
      display_name: data.displayName.trim(),
      station_type: data.stationType || "KITCHEN",
      is_active: data.isActive !== undefined ? data.isActive : true,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.insert("kds_stations", stationData) as KDSStation;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `INSERT INTO kds_stations (tenant_id, branch_id, name, display_name, station_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          stationData.tenant_id,
          stationData.branch_id,
          stationData.name,
          stationData.display_name,
          stationData.station_type,
          stationData.is_active,
        ]
      );
      return res.rows[0];
    }
  }

  async updateStation(
    tenantId: string,
    stationId: string,
    updates: Partial<Pick<KDSStation, "name" | "display_name" | "station_type" | "is_active">>
  ): Promise<KDSStation> {
    const station = await this.getStationById(tenantId, stationId);
    if (!station) throw new Error("Station not found");

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.update("kds_stations", stationId, updates) as KDSStation;
    } else {
      const pool = getPostgresPool();
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, val] of Object.entries(updates)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
      values.push(stationId, tenantId);

      const res = await pool.query(
        `UPDATE kds_stations SET ${fields.join(", ")}, updated_at = NOW()
         WHERE id = $${idx++} AND tenant_id = $${idx++}
         RETURNING *`,
        values
      );
      return res.rows[0];
    }
  }

  async deleteStation(tenantId: string, stationId: string): Promise<boolean> {
    const station = await this.getStationById(tenantId, stationId);
    if (!station) return false;

    await this.updateStation(tenantId, stationId, { is_active: false });
    return true;
  }

  async assignProductToStation(
    tenantId: string,
    branchId: string,
    stationId: string,
    productId?: string | null,
    categoryId?: string | null
  ): Promise<ProductStationAssignment> {
    const record = {
      tenant_id: tenantId,
      branch_id: branchId,
      station_id: stationId,
      product_id: productId || null,
      category_id: categoryId || null,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.insert("product_station_assignments", record) as ProductStationAssignment;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `INSERT INTO product_station_assignments (tenant_id, branch_id, station_id, product_id, category_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [tenantId, branchId, stationId, productId || null, categoryId || null]
      );
      return res.rows[0];
    }
  }

  // ── Routing Orders to Stations ─────────────────────────────────────────────

  /**
   * Routes confirmed order items to respective KDS stations
   * (PHASE 00 Section 26 & Architectural Contract: Multi-Station Architecture)
   * Zero Customer PII on KDS tickets (names, phones, and addresses stripped)
   */
  async routeOrderToStations(order: Order, items: OrderItem[]): Promise<KDSTicket[]> {
    const tenantId = order.tenant_id;
    const branchId = order.branch_id;

    // Idempotency: return existing tickets if already routed
    const existing = await this.getTicketsForOrder(tenantId, order.id);
    if (existing.length > 0) {
      return existing;
    }

    const stations = await this.getStationsForBranch(tenantId, branchId);
    if (stations.length === 0) {
      return [];
    }

    // Load assignments for branch
    let assignments: ProductStationAssignment[] = [];
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      assignments = memoryDb.find(
        "product_station_assignments",
        (a: any) => a.tenant_id === tenantId && a.branch_id === branchId
      ) as ProductStationAssignment[];
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT * FROM product_station_assignments WHERE tenant_id = $1 AND branch_id = $2`,
        [tenantId, branchId]
      );
      assignments = res.rows;
    }

    // Default station fallback: first kitchen station or first active station
    const defaultStation = stations.find((s) => s.station_type === "KITCHEN") || stations[0];

    // Group items by station ID
    const stationItemsMap = new Map<string, OrderItem[]>();

    for (const item of items) {
      // Find matching assignment
      let targetStationId: string | null = null;

      const directAssignment = assignments.find((a) => a.product_id === item.product_id);
      if (directAssignment) {
        targetStationId = directAssignment.station_id;
      } else {
        // Fallback to default station
        targetStationId = defaultStation.id;
      }

      if (!stationItemsMap.has(targetStationId)) {
        stationItemsMap.set(targetStationId, []);
      }
      stationItemsMap.get(targetStationId)!.push(item);
    }

    const priority: KDSTicketPriority = order.notes?.includes("VIP") ? "VIP" : "NORMAL";
    const createdTickets: KDSTicket[] = [];

    for (const [stationId, stationItems] of stationItemsMap.entries()) {
      const ticketRecord = {
        tenant_id: tenantId,
        branch_id: branchId,
        station_id: stationId,
        order_id: order.id,
        order_number: order.order_number,
        status: "QUEUED" as KDSTicketStatus,
        priority,
        started_at: null,
        ready_at: null,
        completed_at: null,
        recalled_at: null,
        cook_id: null,
      };

      let savedTicket: KDSTicket;
      const savedTicketItems: KDSTicketItem[] = [];

      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        savedTicket = memoryDb.insert("kds_tickets", ticketRecord) as KDSTicket;

        for (const item of stationItems) {
          const tktItem = memoryDb.insert("kds_ticket_items", {
            tenant_id: tenantId,
            ticket_id: savedTicket.id,
            order_item_id: item.id,
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            notes: item.notes || null,
            selected_modifiers: item.selected_modifiers || [],
            status: "PENDING",
          });
          savedTicketItems.push(tktItem as KDSTicketItem);
        }
        savedTicket.items = savedTicketItems;
      } else {
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const tRes = await client.query(
            `INSERT INTO kds_tickets (
              tenant_id, branch_id, station_id, order_id, order_number, status, priority
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
              ticketRecord.tenant_id,
              ticketRecord.branch_id,
              ticketRecord.station_id,
              ticketRecord.order_id,
              ticketRecord.order_number,
              ticketRecord.status,
              ticketRecord.priority,
            ]
          );
          savedTicket = tRes.rows[0];

          for (const item of stationItems) {
            const iRes = await client.query(
              `INSERT INTO kds_ticket_items (
                tenant_id, ticket_id, order_item_id, product_id, name, quantity, notes, selected_modifiers, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
              RETURNING *`,
              [
                tenantId,
                savedTicket.id,
                item.id,
                item.product_id,
                item.name,
                item.quantity,
                item.notes || null,
                JSON.stringify(item.selected_modifiers || []),
              ]
            );
            savedTicketItems.push(iRes.rows[0]);
          }
          await client.query("COMMIT");
          savedTicket.items = savedTicketItems;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      }

      createdTickets.push(savedTicket);

      // Publish Outbox Event (Zero Customer PII)
      await eventBus.publish({
        eventType: "KDSTicketCreated",
        tenantId,
        branchId,
        correlationId: crypto.randomUUID(),
        actor: { actorId: "SYSTEM", actorType: "SYSTEM" },
        payload: {
          ticketId: savedTicket.id,
          stationId,
          orderId: order.id,
          orderNumber: order.order_number,
          priority: savedTicket.priority,
          status: savedTicket.status,
          itemsCount: savedTicketItems.length,
          queuedAt: new Date().toISOString(),
        },
      });
    }

    return createdTickets;
  }

  // ── Ticket Lifecycle Transitions ───────────────────────────────────────────

  /**
   * Start preparing ticket: QUEUED -> STARTED
   */
  async startTicket(
    tenantId: string,
    ticketId: string,
    cookId: string,
    actorId: string = cookId
  ): Promise<KDSTicket> {
    const ticket = await this.getTicketRaw(tenantId, ticketId);
    if (!ticket) throw new Error("KDS ticket not found");

    if (!canTransitionKDSTicket(ticket.status, "STARTED")) {
      throw new Error(`Cannot start ticket in status ${ticket.status}`);
    }

    const now = new Date();
    const patch = {
      status: "STARTED" as KDSTicketStatus,
      started_at: now,
      cook_id: cookId,
      updated_at: now,
    };

    const updated = await this.updateTicketRaw(tenantId, ticketId, patch);

    await eventBus.publish({
      eventType: "KDSTicketStarted",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType: "USER" },
      payload: {
        ticketId: updated.id,
        stationId: updated.station_id,
        orderId: updated.order_id,
        orderNumber: updated.order_number,
        cookId,
        startedAt: now.toISOString(),
      },
    });

    return updated;
  }

  /**
   * Cook marks ticket ready: STARTED -> READY
   * Checks if all tickets for this order are ready; if so, triggers OrderReady downstream
   * (PHASE 00 Section 26: Event-driven relationship between KDS and Order/Delivery)
   */
  async readyTicket(
    tenantId: string,
    ticketId: string,
    cookId: string,
    actorId: string = cookId
  ): Promise<{ ticket: KDSTicket; allStationsReady: boolean }> {
    const ticket = await this.getTicketRaw(tenantId, ticketId);
    if (!ticket) throw new Error("KDS ticket not found");

    if (!canTransitionKDSTicket(ticket.status, "READY")) {
      throw new Error(`Cannot mark ready for ticket in status ${ticket.status}`);
    }

    const now = new Date();
    const patch = {
      status: "READY" as KDSTicketStatus,
      ready_at: now,
      updated_at: now,
    };

    const updated = await this.updateTicketRaw(tenantId, ticketId, patch);

    // Publish KDSTicketReady
    await eventBus.publish({
      eventType: "KDSTicketReady",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType: "USER" },
      payload: {
        ticketId: updated.id,
        stationId: updated.station_id,
        orderId: updated.order_id,
        orderNumber: updated.order_number,
        readyAt: now.toISOString(),
      },
    });

    // Cross-station check: Are all station tickets for this order READY?
    const allOrderTickets = await this.getTicketsForOrder(tenantId, updated.order_id);
    const allStationsReady = allOrderTickets.every(
      (t) => t.status === "READY" || t.status === "COMPLETED"
    );

    if (allStationsReady) {
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        const order = memoryDb.findById("orders", updated.order_id);
        if (order) {
          memoryDb.update("orders", order.id, {
            status: "READY",
            actual_ready_at: now,
            updated_at: now,
          });
        }
      } else {
        const pool = getPostgresPool();
        await pool.query(
          `UPDATE orders SET status = 'READY', actual_ready_at = $1, updated_at = $1 WHERE id = $2 AND tenant_id = $3`,
          [now.toISOString(), updated.order_id, tenantId]
        );
      }

      // Trigger OrderReady event downstream
      await eventBus.publish({
        eventType: "OrderReady",
        tenantId,
        branchId: updated.branch_id,
        correlationId: crypto.randomUUID(),
        actor: { actorId, actorType: "SYSTEM" },
        payload: {
          orderId: updated.order_id,
          orderNumber: updated.order_number,
          readyAt: now.toISOString(),
        },
      });
    }

    return { ticket: updated, allStationsReady };
  }

  /**
   * Expo bumps ticket: READY -> COMPLETED
   */
  async bumpTicket(
    tenantId: string,
    ticketId: string,
    actorId: string
  ): Promise<KDSTicket> {
    const ticket = await this.getTicketRaw(tenantId, ticketId);
    if (!ticket) throw new Error("KDS ticket not found");

    if (!canTransitionKDSTicket(ticket.status, "COMPLETED")) {
      throw new Error(`Cannot bump ticket in status ${ticket.status}`);
    }

    const now = new Date();
    const patch = {
      status: "COMPLETED" as KDSTicketStatus,
      completed_at: now,
      updated_at: now,
    };

    const updated = await this.updateTicketRaw(tenantId, ticketId, patch);

    await eventBus.publish({
      eventType: "KDSTicketBumped",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType: "USER" },
      payload: {
        ticketId: updated.id,
        stationId: updated.station_id,
        orderId: updated.order_id,
        orderNumber: updated.order_number,
        completedAt: now.toISOString(),
      },
    });

    return updated;
  }

  /**
   * Expo recalls bumped ticket: COMPLETED -> RECALLED
   */
  async recallTicket(
    tenantId: string,
    ticketId: string,
    actorId: string
  ): Promise<KDSTicket> {
    const ticket = await this.getTicketRaw(tenantId, ticketId);
    if (!ticket) throw new Error("KDS ticket not found");

    if (!canTransitionKDSTicket(ticket.status, "RECALLED")) {
      throw new Error(`Cannot recall ticket in status ${ticket.status}`);
    }

    const now = new Date();
    const patch = {
      status: "RECALLED" as KDSTicketStatus,
      recalled_at: now,
      updated_at: now,
    };

    const updated = await this.updateTicketRaw(tenantId, ticketId, patch);

    await eventBus.publish({
      eventType: "KDSTicketRecalled",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType: "USER" },
      payload: {
        ticketId: updated.id,
        stationId: updated.station_id,
        orderId: updated.order_id,
        orderNumber: updated.order_number,
        recalledAt: now.toISOString(),
      },
    });

    return updated;
  }

  // ── Ticket Queries with SLA Calculation ────────────────────────────────────

  async getTicketsForStation(
    tenantId: string,
    branchId: string,
    stationId?: string | null,
    statuses: KDSTicketStatus[] = ["QUEUED", "STARTED", "READY", "RECALLED"]
  ): Promise<KDSTicket[]> {
    let tickets: KDSTicket[] = [];

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      tickets = memoryDb.find("kds_tickets", (t: any) => {
        if (t.tenant_id !== tenantId) return false;
        if (t.branch_id !== branchId) return false;
        if (stationId && t.station_id !== stationId) return false;
        if (statuses.length > 0 && !statuses.includes(t.status)) return false;
        return true;
      }) as KDSTicket[];

      for (const t of tickets) {
        t.items = memoryDb.find(
          "kds_ticket_items",
          (i: any) => i.ticket_id === t.id && i.tenant_id === tenantId
        ) as KDSTicketItem[];
      }
    } else {
      const pool = getPostgresPool();
      let query = `SELECT * FROM kds_tickets WHERE tenant_id = $1 AND branch_id = $2`;
      const params: any[] = [tenantId, branchId];
      let idx = 3;

      if (stationId) {
        query += ` AND station_id = $${idx++}`;
        params.push(stationId);
      }

      if (statuses.length > 0) {
        query += ` AND status = ANY($${idx++})`;
        params.push(statuses);
      }

      query += ` ORDER BY created_at ASC`;
      const res = await pool.query(query, params);
      tickets = res.rows;

      for (const t of tickets) {
        const itemRes = await pool.query(
          `SELECT * FROM kds_ticket_items WHERE ticket_id = $1 AND tenant_id = $2`,
          [t.id, tenantId]
        );
        t.items = itemRes.rows;
      }
    }

    // Enrich each ticket with SLA metrics (Zero Customer PII)
    const now = new Date();
    return tickets.map((t) => {
      const sla = computeKDSSLA(t.created_at, 15, now);
      return {
        ...t,
        sla_status: sla.slaStatus,
        elapsed_seconds: sla.elapsedSeconds,
        remaining_seconds: sla.remainingSeconds,
        formatted_timer: sla.formattedTimer,
      };
    });
  }

  async getTicketsForOrder(tenantId: string, orderId: string): Promise<KDSTicket[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find(
        "kds_tickets",
        (t: any) => t.tenant_id === tenantId && t.order_id === orderId
      ) as KDSTicket[];
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT * FROM kds_tickets WHERE tenant_id = $1 AND order_id = $2`,
        [tenantId, orderId]
      );
      return res.rows;
    }
  }

  private async getTicketRaw(tenantId: string, ticketId: string): Promise<KDSTicket | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const t = memoryDb.findById("kds_tickets", ticketId);
      if (!t || t.tenant_id !== tenantId) return null;
      return t as KDSTicket;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT * FROM kds_tickets WHERE id = $1 AND tenant_id = $2`,
        [ticketId, tenantId]
      );
      return res.rows[0] || null;
    }
  }

  private async updateTicketRaw(
    tenantId: string,
    ticketId: string,
    updates: Partial<KDSTicket>
  ): Promise<KDSTicket> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const updated = memoryDb.update("kds_tickets", ticketId, updates);
      if (!updated) throw new Error("Failed to update ticket");
      return updated as KDSTicket;
    } else {
      const pool = getPostgresPool();
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, val] of Object.entries(updates)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
      values.push(ticketId, tenantId);

      const res = await pool.query(
        `UPDATE kds_tickets SET ${fields.join(", ")}, updated_at = NOW()
         WHERE id = $${idx++} AND tenant_id = $${idx++}
         RETURNING *`,
        values
      );
      return res.rows[0];
    }
  }
}

export const kdsService = new KDSService();
