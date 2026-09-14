import { memoryDb, getPostgresPool } from "@/core/database/db";
import { DriverQueueEntry, DriverRecord, ShiftStatus, AssignmentStatus, TripStatus } from "../domain/delivery";
import { auditLogger } from "@/core/audit/audit-logger";

export class DriverQueueService {
  /**
   * Get or create a driver record for a user
   */
  async getOrCreateDriver(tenantId: string, branchId: string, userId: string): Promise<DriverRecord> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      let driver = memoryDb.find(
        "drivers",
        (d: any) => d.tenant_id === tenantId && d.user_id === userId
      )[0];

      if (!driver) {
        driver = {
          id: `drv_${crypto.randomUUID()}`,
          tenant_id: tenantId,
          branch_id: branchId,
          user_id: userId,
          shift_status: "OFF_SHIFT",
          assignment_status: "AVAILABLE",
          trip_status: "NOT_STARTED",
          available_since: null,
          is_active: true,
          can_self_assign: true,
          can_self_batch: false,
          created_at: new Date(),
          updated_at: new Date(),
        };
        memoryDb.insert("drivers", driver);
      }
      return driver;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM drivers WHERE tenant_id = $1 AND user_id = $2",
        [tenantId, userId]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }

      const id = `drv_${crypto.randomUUID()}`;
      const insertRes = await pool.query(
        `INSERT INTO drivers (
          id, tenant_id, branch_id, user_id, shift_status, assignment_status, trip_status,
          is_active, can_self_assign, can_self_batch, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'OFF_SHIFT', 'AVAILABLE', 'NOT_STARTED', true, true, false, NOW(), NOW())
        RETURNING *`,
        [id, tenantId, branchId, userId]
      );
      return insertRes.rows[0];
    }
  }

  /**
   * Driver Clock-In: Shift begins, joins queue at available_since = NOW()
   */
  async clockIn(tenantId: string, branchId: string, userId: string): Promise<DriverRecord> {
    const driver = await this.getOrCreateDriver(tenantId, branchId, userId);
    const now = new Date();

    const updatedData: Partial<DriverRecord> = {
      shift_status: "ON_SHIFT",
      assignment_status: "AVAILABLE",
      trip_status: "NOT_STARTED",
      available_since: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("drivers", driver.id, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE drivers SET
          shift_status = 'ON_SHIFT', assignment_status = 'AVAILABLE', trip_status = 'NOT_STARTED',
          available_since = $1, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, driver.id, tenantId]
      );
    }

    await auditLogger.log({
      actor: { actorId: userId, actorType: "USER" },
      action: "DRIVER_CLOCKED_IN",
      entity: "Driver",
      entityId: driver.id,
      metadata: { availableSince: now.toISOString() },
    });

    return { ...driver, ...updatedData } as DriverRecord;
  }

  /**
   * Driver Break: Temporarily leaves queue
   */
  async startBreak(tenantId: string, branchId: string, userId: string): Promise<DriverRecord> {
    const driver = await this.getOrCreateDriver(tenantId, branchId, userId);
    const now = new Date();

    const updatedData: Partial<DriverRecord> = {
      shift_status: "BREAK",
      available_since: null, // Removed from eligible FIFO availability queue
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("drivers", driver.id, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE drivers SET shift_status = 'BREAK', available_since = NULL, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, driver.id, tenantId]
      );
    }

    await auditLogger.log({
      actor: { actorId: userId, actorType: "USER" },
      action: "DRIVER_WENT_ON_BREAK",
      entity: "Driver",
      entityId: driver.id,
    });

    return { ...driver, ...updatedData } as DriverRecord;
  }

  /**
   * Return from Break (PHASE 00 Section 8):
   * Emits DriverReturnedFromBreak, rejoins end of FIFO queue with available_since = NOW()
   */
  async returnFromBreak(tenantId: string, branchId: string, userId: string): Promise<DriverRecord> {
    const driver = await this.getOrCreateDriver(tenantId, branchId, userId);
    const now = new Date();

    const updatedData: Partial<DriverRecord> = {
      shift_status: "ON_SHIFT",
      assignment_status: "AVAILABLE",
      available_since: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("drivers", driver.id, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE drivers SET
          shift_status = 'ON_SHIFT', assignment_status = 'AVAILABLE',
          available_since = $1, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, driver.id, tenantId]
      );
    }

    await auditLogger.log({
      actor: { actorId: userId, actorType: "USER" },
      action: "DRIVER_RETURNED_FROM_BREAK",
      entity: "Driver",
      entityId: driver.id,
      metadata: { availableSince: now.toISOString() },
    });

    return { ...driver, ...updatedData } as DriverRecord;
  }

  /**
   * Physical Return to Restaurant (PHASE 00 Section 8):
   * Emits DriverReturnedToRestaurant, rejoins end of FIFO queue with available_since = NOW()
   */
  async arrivedAtRestaurant(tenantId: string, branchId: string, userId: string): Promise<DriverRecord> {
    const driver = await this.getOrCreateDriver(tenantId, branchId, userId);
    const now = new Date();

    const updatedData: Partial<DriverRecord> = {
      shift_status: "ON_SHIFT",
      assignment_status: "AVAILABLE",
      trip_status: "NOT_STARTED",
      available_since: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("drivers", driver.id, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE drivers SET
          shift_status = 'ON_SHIFT', assignment_status = 'AVAILABLE', trip_status = 'NOT_STARTED',
          available_since = $1, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, driver.id, tenantId]
      );
    }

    await auditLogger.log({
      actor: { actorId: userId, actorType: "USER" },
      action: "DRIVER_RETURNED_TO_RESTAURANT",
      entity: "Driver",
      entityId: driver.id,
      metadata: { availableSince: now.toISOString() },
    });

    return { ...driver, ...updatedData } as DriverRecord;
  }

  /**
   * Driver Clock-Out: End shift, removed from queue
   */
  async clockOut(tenantId: string, branchId: string, userId: string): Promise<DriverRecord> {
    const driver = await this.getOrCreateDriver(tenantId, branchId, userId);
    const now = new Date();

    const updatedData: Partial<DriverRecord> = {
      shift_status: "OFF_SHIFT",
      assignment_status: "AVAILABLE",
      trip_status: "NOT_STARTED",
      available_since: null,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("drivers", driver.id, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE drivers SET
          shift_status = 'OFF_SHIFT', assignment_status = 'AVAILABLE', trip_status = 'NOT_STARTED',
          available_since = NULL, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, driver.id, tenantId]
      );
    }

    await auditLogger.log({
      actor: { actorId: userId, actorType: "USER" },
      action: "DRIVER_CLOCKED_OUT",
      entity: "Driver",
      entityId: driver.id,
    });

    return { ...driver, ...updatedData } as DriverRecord;
  }

  /**
   * Derive the FIFO Driver Availability Queue (PHASE 00 Section 7 & ADR 0007)
   * Priority strictly ordered by available_since ASC, stable ID tie-breaker.
   */
  async getDriverQueue(tenantId: string, branchId: string): Promise<DriverQueueEntry[]> {
    let activeDrivers: any[] = [];

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      activeDrivers = memoryDb.find("drivers", (d: any) => {
        return (
          d.tenant_id === tenantId &&
          d.branch_id === branchId &&
          d.is_active === true &&
          d.shift_status === "ON_SHIFT" &&
          d.assignment_status === "AVAILABLE" &&
          d.available_since !== null
        );
      });
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT * FROM drivers
         WHERE tenant_id = $1 AND branch_id = $2 AND is_active = true
           AND shift_status = 'ON_SHIFT' AND assignment_status = 'AVAILABLE'
           AND available_since IS NOT NULL`,
        [tenantId, branchId]
      );
      activeDrivers = res.rows;
    }

    // Sort strictly by available_since ASC, with driver id as stable tie-breaker
    activeDrivers.sort((a, b) => {
      const timeA = new Date(a.available_since).getTime();
      const timeB = new Date(b.available_since).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

    // Project queue entries with 1-based position and user names
    return activeDrivers.map((d, index) => {
      let driverName = "Driver";
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        const user = memoryDb.findById("users", d.user_id);
        if (user) driverName = `${user.first_name} ${user.last_name}`.trim();
      }

      return {
        driverId: d.id,
        userId: d.user_id,
        driverName,
        shiftStatus: d.shift_status,
        assignmentStatus: d.assignment_status,
        tripStatus: d.trip_status,
        availableSince: new Date(d.available_since).toISOString(),
        queuePosition: index + 1,
        canSelfAssign: d.can_self_assign,
      };
    });
  }
}

export const driverQueueService = new DriverQueueService();
