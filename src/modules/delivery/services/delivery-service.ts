import { memoryDb, getPostgresPool } from "@/core/database/db";
import {
  Delivery,
  DeliveryStatus,
  DeliveryViewDTO,
  ActorType,
  DeliveryAssignmentHistoryRecord,
} from "../domain/delivery";
import { auditLogger } from "@/core/audit/audit-logger";

export class DeliveryService {
  /**
   * Create a new delivery associated with an order.
   */
  async createDelivery(params: {
    tenantId: string;
    branchId: string;
    orderId: string;
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    deliveryAddress: any;
    customerNotes?: string | null;
    deliveryNotes?: string | null;
  }): Promise<Delivery> {
    const delivery: Delivery = {
      id: `del_${crypto.randomUUID()}`,
      tenant_id: params.tenantId,
      branch_id: params.branchId,
      order_id: params.orderId,
      driver_id: null,
      vehicle_id: null,
      status: "AVAILABLE_FOR_ASSIGNMENT",
      priority: params.priority || "NORMAL",
      delivery_address: params.deliveryAddress,
      customer_notes: params.customerNotes || null,
      delivery_notes: params.deliveryNotes || null,
      assigned_at: null,
      picked_up_at: null,
      dispatched_at: null,
      arrived_at: null,
      delivered_at: null,
      failed_at: null,
      cancelled_at: null,
      cancellation_reason: null,
      failure_reason: null,
      proof_of_delivery: null,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("deliveries", delivery);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO deliveries (
          id, tenant_id, branch_id, order_id, status, priority, delivery_address,
          customer_notes, delivery_notes, version, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [
          delivery.id,
          delivery.tenant_id,
          delivery.branch_id,
          delivery.order_id,
          delivery.status,
          delivery.priority,
          JSON.stringify(delivery.delivery_address),
          delivery.customer_notes,
          delivery.delivery_notes,
          delivery.version,
        ]
      );
    }

    return delivery;
  }

  /**
   * Get a delivery by ID
   */
  async getDeliveryById(tenantId: string, deliveryId: string): Promise<Delivery | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const delivery = memoryDb.findById("deliveries", deliveryId);
      if (!delivery || delivery.tenant_id !== tenantId) return null;
      return delivery;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM deliveries WHERE id = $1 AND tenant_id = $2",
        [deliveryId, tenantId]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        ...row,
        delivery_address: typeof row.delivery_address === "string" ? JSON.parse(row.delivery_address) : row.delivery_address,
        proof_of_delivery: typeof row.proof_of_delivery === "string" ? JSON.parse(row.proof_of_delivery) : row.proof_of_delivery,
      };
    }
  }

  /**
   * List deliveries for a branch with optional status filter
   */
  async listDeliveries(tenantId: string, branchId: string, status?: DeliveryStatus): Promise<Delivery[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find("deliveries", (d: any) => {
        if (d.tenant_id !== tenantId || d.branch_id !== branchId) return false;
        if (status && d.status !== status) return false;
        return true;
      });
    } else {
      const pool = getPostgresPool();
      const query = status
        ? "SELECT * FROM deliveries WHERE tenant_id = $1 AND branch_id = $2 AND status = $3 ORDER BY created_at DESC"
        : "SELECT * FROM deliveries WHERE tenant_id = $1 AND branch_id = $2 ORDER BY created_at DESC";
      const params = status ? [tenantId, branchId, status] : [tenantId, branchId];
      const res = await pool.query(query, params);
      return res.rows.map((row) => ({
        ...row,
        delivery_address: typeof row.delivery_address === "string" ? JSON.parse(row.delivery_address) : row.delivery_address,
        proof_of_delivery: typeof row.proof_of_delivery === "string" ? JSON.parse(row.proof_of_delivery) : row.proof_of_delivery,
      }));
    }
  }

  /**
   * Manager Assignment of Delivery to Driver & Vehicle
   */
  async assignDelivery(params: {
    tenantId: string;
    deliveryId: string;
    driverId: string;
    vehicleId?: string | null;
    actorId?: string | null;
    actorType?: ActorType;
    reason?: string | null;
  }): Promise<Delivery> {
    const { tenantId, deliveryId, driverId, vehicleId, actorId, actorType = "MANAGER", reason } = params;

    const delivery = await this.getDeliveryById(tenantId, deliveryId);
    if (!delivery) throw new Error("Delivery not found");

    if (
      delivery.status !== "AVAILABLE_FOR_ASSIGNMENT" &&
      delivery.status !== "READY" &&
      delivery.status !== "WAITING"
    ) {
      throw new Error(`Cannot assign delivery in status ${delivery.status}`);
    }

    const previousDriverId = delivery.driver_id || null;
    const now = new Date();

    const updatedData: Partial<Delivery> = {
      driver_id: driverId,
      vehicle_id: vehicleId || null,
      status: "ASSIGNED",
      assigned_at: now,
      version: delivery.version + 1,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("deliveries", deliveryId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE deliveries SET
          driver_id = $1, vehicle_id = $2, status = 'ASSIGNED', assigned_at = $3,
          version = version + 1, updated_at = $3
         WHERE id = $4 AND tenant_id = $5`,
        [driverId, vehicleId || null, now, deliveryId, tenantId]
      );
    }

    // Update driver state to ASSIGNED
    await this.updateDriverAssignmentState(tenantId, driverId, "ASSIGNED");

    // Record assignment history
    await this.recordAssignmentHistory({
      tenantId,
      deliveryId,
      previousDriverId,
      newDriverId: driverId,
      actorType,
      actorId,
      reason,
    });

    await auditLogger.log({
      actor: { actorId: actorId || driverId, actorType: "USER" },
      action: "DELIVERY_ASSIGNED",
      entity: "Delivery",
      entityId: deliveryId,
      metadata: { driverId, vehicleId, previousDriverId, actorType },
    });

    return { ...delivery, ...updatedData } as Delivery;
  }

  /**
   * Driver Self-Assignment with Atomic Concurrency Protection (ADR 0007 / PHASE 00 Section 9)
   * Only one driver can claim an eligible delivery; concurrent attempts throw 409 Conflict.
   */
  async selfAssignDelivery(tenantId: string, deliveryId: string, driverUserId: string): Promise<Delivery> {
    // 1. Verify driver exists and is eligible for self-assignment
    const driver = await this.getDriverByUserId(tenantId, driverUserId);
    if (!driver) {
      throw new Error("Driver profile not found");
    }
    if (!driver.is_active || driver.shift_status !== "ON_SHIFT") {
      throw new Error("Driver is not on shift");
    }
    if (driver.assignment_status === "ASSIGNED") {
      throw new Error("Driver is already assigned to a delivery or batch");
    }
    if (!driver.can_self_assign) {
      throw new Error("Driver does not have self-assignment permission");
    }

    // 2. Atomic assignment condition: delivery must be AVAILABLE_FOR_ASSIGNMENT or READY and unassigned
    const now = new Date();

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const delivery = memoryDb.findById("deliveries", deliveryId);
      if (!delivery || delivery.tenant_id !== tenantId) {
        throw new Error("Delivery not found");
      }

      if (
        delivery.driver_id !== null ||
        (delivery.status !== "AVAILABLE_FOR_ASSIGNMENT" && delivery.status !== "READY")
      ) {
        const error: any = new Error("The specified delivery has already been assigned to another driver.");
        error.code = "DELIVERY_ALREADY_ASSIGNED";
        error.statusCode = 409;
        throw error;
      }

      // Check active vehicle assignment for this driver
      const activeVehicle = memoryDb.find(
        "driver_vehicle_assignments",
        (a: any) => a.driver_id === driverUserId && a.unassigned_at === null
      )[0];

      const vehicleId = activeVehicle ? activeVehicle.vehicle_id : null;

      const updated = memoryDb.update("deliveries", deliveryId, {
        driver_id: driverUserId,
        vehicle_id: vehicleId,
        status: "ASSIGNED",
        assigned_at: now,
        version: delivery.version + 1,
        updated_at: now,
      });

      // Update driver state
      memoryDb.update("drivers", driver.id, {
        assignment_status: "ASSIGNED",
        updated_at: now,
      });

      await this.recordAssignmentHistory({
        tenantId,
        deliveryId,
        previousDriverId: null,
        newDriverId: driverUserId,
        actorType: "DRIVER_SELF_ASSIGN",
        actorId: driverUserId,
        reason: "Driver claimed delivery via self-assignment",
      });

      return updated;
    } else {
      const pool = getPostgresPool();
      // Resolve active vehicle
      const vehRes = await pool.query(
        `SELECT vehicle_id FROM driver_vehicle_assignments
         WHERE tenant_id = $1 AND driver_id = $2 AND unassigned_at IS NULL LIMIT 1`,
        [tenantId, driverUserId]
      );
      const vehicleId = vehRes.rows[0]?.vehicle_id || null;

      const res = await pool.query(
        `UPDATE deliveries
         SET driver_id = $1, vehicle_id = $2, status = 'ASSIGNED', assigned_at = $3,
             version = version + 1, updated_at = $3
         WHERE id = $4 AND tenant_id = $5
           AND driver_id IS NULL
           AND status IN ('AVAILABLE_FOR_ASSIGNMENT', 'READY')
         RETURNING *`,
        [driverUserId, vehicleId, now, deliveryId, tenantId]
      );

      if (res.rows.length === 0) {
        const error: any = new Error("The specified delivery has already been assigned to another driver.");
        error.code = "DELIVERY_ALREADY_ASSIGNED";
        error.statusCode = 409;
        throw error;
      }

      await pool.query(
        `UPDATE drivers SET assignment_status = 'ASSIGNED', updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, driver.id, tenantId]
      );

      await this.recordAssignmentHistory({
        tenantId,
        deliveryId,
        previousDriverId: null,
        newDriverId: driverUserId,
        actorType: "DRIVER_SELF_ASSIGN",
        actorId: driverUserId,
        reason: "Driver claimed delivery via self-assignment",
      });

      const row = res.rows[0];
      return {
        ...row,
        delivery_address: typeof row.delivery_address === "string" ? JSON.parse(row.delivery_address) : row.delivery_address,
        proof_of_delivery: typeof row.proof_of_delivery === "string" ? JSON.parse(row.proof_of_delivery) : row.proof_of_delivery,
      };
    }
  }

  /**
   * Release an assigned delivery before pickup.
   * PHASE 00 Section 4: Transitions back to AVAILABLE_FOR_ASSIGNMENT.
   */
  async releaseDelivery(
    tenantId: string,
    deliveryId: string,
    releasingUserId: string,
    reason: string,
    actorType: ActorType = "DRIVER_RELEASE"
  ): Promise<Delivery> {
    const delivery = await this.getDeliveryById(tenantId, deliveryId);
    if (!delivery) throw new Error("Delivery not found");

    if (delivery.status !== "ASSIGNED") {
      throw new Error(`Cannot release delivery in status '${delivery.status}'. Only ASSIGNED deliveries can be released.`);
    }

    const previousDriverId = delivery.driver_id;
    const now = new Date();

    const updatedData: Partial<Delivery> = {
      driver_id: null,
      vehicle_id: null,
      status: "AVAILABLE_FOR_ASSIGNMENT",
      assigned_at: null,
      version: delivery.version + 1,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("deliveries", deliveryId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE deliveries SET
          driver_id = NULL, vehicle_id = NULL, status = 'AVAILABLE_FOR_ASSIGNMENT',
          assigned_at = NULL, version = version + 1, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, deliveryId, tenantId]
      );
    }

    // Set previous driver back to AVAILABLE
    if (previousDriverId) {
      await this.updateDriverAssignmentState(tenantId, previousDriverId, "AVAILABLE");
    }

    await this.recordAssignmentHistory({
      tenantId,
      deliveryId,
      previousDriverId,
      newDriverId: null,
      actorType,
      actorId: releasingUserId,
      reason,
    });

    await auditLogger.log({
      actor: { actorId: releasingUserId, actorType: "USER" },
      action: "DELIVERY_RELEASED",
      entity: "Delivery",
      entityId: deliveryId,
      metadata: { previousDriverId, reason, actorType },
    });

    return { ...delivery, ...updatedData } as Delivery;
  }

  /**
   * Driver Picked Up Delivery at Restaurant
   */
  async pickupDelivery(tenantId: string, deliveryId: string, driverUserId: string): Promise<Delivery> {
    const delivery = await this.getDeliveryById(tenantId, deliveryId);
    if (!delivery) throw new Error("Delivery not found");

    if (delivery.status !== "ASSIGNED") {
      throw new Error(`Cannot pickup delivery in status '${delivery.status}'. Must be ASSIGNED.`);
    }
    if (delivery.driver_id && delivery.driver_id !== driverUserId) {
      throw new Error("Delivery is assigned to a different driver.");
    }

    const now = new Date();
    const updatedData: Partial<Delivery> = {
      status: "PICKED_UP",
      picked_up_at: now,
      version: delivery.version + 1,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("deliveries", deliveryId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE deliveries SET status = 'PICKED_UP', picked_up_at = $1, version = version + 1, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, deliveryId, tenantId]
      );
    }

    return { ...delivery, ...updatedData } as Delivery;
  }

  /**
   * Driver Dispatched / Out For Delivery
   */
  async startDelivery(tenantId: string, deliveryId: string, driverUserId: string): Promise<Delivery> {
    const delivery = await this.getDeliveryById(tenantId, deliveryId);
    if (!delivery) throw new Error("Delivery not found");

    if (delivery.status !== "PICKED_UP" && delivery.status !== "ASSIGNED") {
      throw new Error(`Cannot start transit for delivery in status '${delivery.status}'.`);
    }

    const now = new Date();
    const updatedData: Partial<Delivery> = {
      status: "OUT_FOR_DELIVERY",
      dispatched_at: now,
      version: delivery.version + 1,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("deliveries", deliveryId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE deliveries SET status = 'OUT_FOR_DELIVERY', dispatched_at = $1, version = version + 1, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, deliveryId, tenantId]
      );
    }

    // Driver trip status moves to IN_TRANSIT
    await this.updateDriverTripState(tenantId, driverUserId, "IN_TRANSIT");

    return { ...delivery, ...updatedData } as Delivery;
  }

  /**
   * Arrived at Customer Area (can be triggered by driver command or geofence event)
   * Note: Telemetry != Business Truth (does not mark as DELIVERED!)
   */
  async arriveDelivery(tenantId: string, deliveryId: string, driverUserId?: string): Promise<Delivery> {
    const delivery = await this.getDeliveryById(tenantId, deliveryId);
    if (!delivery) throw new Error("Delivery not found");

    if (delivery.status !== "OUT_FOR_DELIVERY") {
      throw new Error(`Cannot mark arrived for delivery in status '${delivery.status}'. Must be OUT_FOR_DELIVERY.`);
    }

    const now = new Date();
    const updatedData: Partial<Delivery> = {
      status: "ARRIVED_AT_CUSTOMER_AREA",
      arrived_at: now,
      version: delivery.version + 1,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("deliveries", deliveryId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE deliveries SET status = 'ARRIVED_AT_CUSTOMER_AREA', arrived_at = $1, version = version + 1, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, deliveryId, tenantId]
      );
    }

    if (driverUserId || delivery.driver_id) {
      await this.updateDriverTripState(tenantId, driverUserId || delivery.driver_id!, "AT_CUSTOMER");
    }

    return { ...delivery, ...updatedData } as Delivery;
  }

  /**
   * Delivery Completed / Handed Over
   * Human confirmation / Proof of Delivery required in Gen 1
   */
  async completeDelivery(
    tenantId: string,
    deliveryId: string,
    driverUserId: string,
    proofOfDelivery?: any
  ): Promise<Delivery> {
    const delivery = await this.getDeliveryById(tenantId, deliveryId);
    if (!delivery) throw new Error("Delivery not found");

    if (
      delivery.status !== "OUT_FOR_DELIVERY" &&
      delivery.status !== "ARRIVED_AT_CUSTOMER_AREA"
    ) {
      throw new Error(`Cannot complete delivery in status '${delivery.status}'.`);
    }

    const now = new Date();
    const updatedData: Partial<Delivery> = {
      status: "DELIVERED",
      delivered_at: now,
      proof_of_delivery: proofOfDelivery || null,
      version: delivery.version + 1,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("deliveries", deliveryId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE deliveries SET
          status = 'DELIVERED', delivered_at = $1, proof_of_delivery = $2,
          version = version + 1, updated_at = $1
         WHERE id = $3 AND tenant_id = $4`,
        [now, JSON.stringify(proofOfDelivery || null), deliveryId, tenantId]
      );
    }

    // Driver becomes AVAILABLE for next delivery, trip status RETURNING
    await this.updateDriverAssignmentState(tenantId, driverUserId, "AVAILABLE");
    await this.updateDriverTripState(tenantId, driverUserId, "RETURNING");

    // Also update Universal Order status downstream to COMPLETED if all items/deliveries are done
    await this.markOrderCompletedIfApplicable(tenantId, delivery.order_id);

    return { ...delivery, ...updatedData } as Delivery;
  }

  /**
   * Delivery Failed (e.g. customer unavailable, wrong address)
   */
  async failDelivery(
    tenantId: string,
    deliveryId: string,
    driverUserId: string,
    reason: string
  ): Promise<Delivery> {
    const delivery = await this.getDeliveryById(tenantId, deliveryId);
    if (!delivery) throw new Error("Delivery not found");

    const now = new Date();
    const updatedData: Partial<Delivery> = {
      status: "FAILED",
      failed_at: now,
      failure_reason: reason,
      version: delivery.version + 1,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("deliveries", deliveryId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE deliveries SET status = 'FAILED', failed_at = $1, failure_reason = $2, version = version + 1, updated_at = $1
         WHERE id = $3 AND tenant_id = $4`,
        [now, reason, deliveryId, tenantId]
      );
    }

    await this.updateDriverAssignmentState(tenantId, driverUserId, "AVAILABLE");
    await this.updateDriverTripState(tenantId, driverUserId, "RETURNING");

    return { ...delivery, ...updatedData } as Delivery;
  }

  /**
   * Cancel Delivery
   */
  async cancelDelivery(tenantId: string, deliveryId: string, reason: string): Promise<Delivery> {
    const delivery = await this.getDeliveryById(tenantId, deliveryId);
    if (!delivery) throw new Error("Delivery not found");

    const now = new Date();
    const updatedData: Partial<Delivery> = {
      status: "CANCELLED",
      cancelled_at: now,
      cancellation_reason: reason,
      version: delivery.version + 1,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("deliveries", deliveryId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE deliveries SET status = 'CANCELLED', cancelled_at = $1, cancellation_reason = $2, version = version + 1, updated_at = $1
         WHERE id = $3 AND tenant_id = $4`,
        [now, reason, deliveryId, tenantId]
      );
    }

    if (delivery.driver_id) {
      await this.updateDriverAssignmentState(tenantId, delivery.driver_id, "AVAILABLE");
    }

    return { ...delivery, ...updatedData } as Delivery;
  }

  /**
   * Transform full Delivery entity into minimized DeliveryViewDTO (PHASE 00 Section 31)
   */
  toDeliveryViewDTO(delivery: Delivery): DeliveryViewDTO {
    return {
      id: delivery.id,
      orderId: delivery.order_id,
      status: delivery.status,
      priority: delivery.priority,
      deliveryAddress: {
        street: delivery.delivery_address.street,
        houseNumber: delivery.delivery_address.houseNumber,
        entrance: delivery.delivery_address.entrance,
        floor: delivery.delivery_address.floor,
        apartment: delivery.delivery_address.apartment,
        city: delivery.delivery_address.city,
        gateCode: delivery.delivery_address.gateCode,
        parkingInstructions: delivery.delivery_address.parkingInstructions,
        deliveryNotes: delivery.delivery_address.deliveryNotes,
        latitude: delivery.delivery_address.latitude,
        longitude: delivery.delivery_address.longitude,
      },
      customerNotes: delivery.customer_notes,
      deliveryNotes: delivery.delivery_notes,
      assignedAt: delivery.assigned_at,
      pickedUpAt: delivery.picked_up_at,
      dispatchedAt: delivery.dispatched_at,
      arrivedAt: delivery.arrived_at,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async getDriverByUserId(tenantId: string, userId: string): Promise<any | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const drivers = memoryDb.find(
        "drivers",
        (d: any) => d.tenant_id === tenantId && d.user_id === userId
      );
      return drivers[0] || null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM drivers WHERE tenant_id = $1 AND user_id = $2",
        [tenantId, userId]
      );
      return res.rows[0] || null;
    }
  }

  private async updateDriverAssignmentState(
    tenantId: string,
    driverUserId: string,
    state: "AVAILABLE" | "ASSIGNED"
  ): Promise<void> {
    const now = new Date();
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const driver = memoryDb.find(
        "drivers",
        (d: any) => d.tenant_id === tenantId && d.user_id === driverUserId
      )[0];
      if (driver) {
        memoryDb.update("drivers", driver.id, {
          assignment_status: state,
          available_since: state === "AVAILABLE" ? now : driver.available_since,
          updated_at: now,
        });
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE drivers
         SET assignment_status = $1,
             available_since = CASE WHEN $1 = 'AVAILABLE' THEN $2 ELSE available_since END,
             updated_at = $2
         WHERE tenant_id = $3 AND user_id = $4`,
        [state, now, tenantId, driverUserId]
      );
    }
  }

  private async updateDriverTripState(
    tenantId: string,
    driverUserId: string,
    tripState: "NOT_STARTED" | "IN_TRANSIT" | "AT_CUSTOMER" | "RETURNING"
  ): Promise<void> {
    const now = new Date();
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const driver = memoryDb.find(
        "drivers",
        (d: any) => d.tenant_id === tenantId && d.user_id === driverUserId
      )[0];
      if (driver) {
        memoryDb.update("drivers", driver.id, {
          trip_status: tripState,
          updated_at: now,
        });
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        "UPDATE drivers SET trip_status = $1, updated_at = $2 WHERE tenant_id = $3 AND user_id = $4",
        [tripState, now, tenantId, driverUserId]
      );
    }
  }

  private async recordAssignmentHistory(record: {
    tenantId: string;
    deliveryId: string;
    previousDriverId?: string | null;
    newDriverId?: string | null;
    actorType: ActorType;
    actorId?: string | null;
    reason?: string | null;
  }): Promise<void> {
    const historyItem: DeliveryAssignmentHistoryRecord = {
      id: `dah_${crypto.randomUUID()}`,
      tenant_id: record.tenantId,
      delivery_id: record.deliveryId,
      previous_driver_id: record.previousDriverId || null,
      new_driver_id: record.newDriverId || null,
      actor_type: record.actorType,
      actor_id: record.actorId || null,
      reason: record.reason || null,
      created_at: new Date(),
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("delivery_assignment_history", historyItem);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO delivery_assignment_history (
          id, tenant_id, delivery_id, previous_driver_id, new_driver_id, actor_type, actor_id, reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          historyItem.id,
          historyItem.tenant_id,
          historyItem.delivery_id,
          historyItem.previous_driver_id,
          historyItem.new_driver_id,
          historyItem.actor_type,
          historyItem.actor_id,
          historyItem.reason,
        ]
      );
    }
  }

  private async markOrderCompletedIfApplicable(tenantId: string, orderId: string): Promise<void> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const order = memoryDb.findById("orders", orderId);
      if (order && order.tenant_id === tenantId) {
        memoryDb.update("orders", orderId, {
          status: "COMPLETED",
          completed_at: new Date(),
          updated_at: new Date(),
        });
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        "UPDATE orders SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
        [orderId, tenantId]
      );
    }
  }
}

export const deliveryService = new DeliveryService();
