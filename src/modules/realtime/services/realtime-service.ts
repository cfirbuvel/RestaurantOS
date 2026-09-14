import crypto from "crypto";
import { memoryDb, getPostgresPool } from "@/core/database/db";
import { Role } from "@/modules/identity/domain/rbac";

export interface RealtimeTicketRecord {
  id: string;
  ticket: string;
  tenant_id: string;
  branch_id: string;
  user_id: string;
  role: Role;
  station_id?: string | null;
  channel: string;
  expires_at: Date | string;
  used_at?: Date | string | null;
  created_at: Date | string;
}

export interface IssueTicketParams {
  tenantId: string;
  branchId: string;
  userId: string;
  role: Role;
  stationId?: string | null;
  channel?: string;
  ttlSeconds?: number;
}

export class RealtimeService {
  /**
   * Determine allowed channels for a user session based on their role and context
   * (PHASE 00 Section 29: Logical Authorization Boundaries)
   */
  getAuthorizedChannels(role: Role, branchId: string, stationId?: string | null): string[] {
    const channels: string[] = [];

    switch (role) {
      case "OWNER":
      case "ADMIN":
      case "MANAGER":
        channels.push(
          `branch:${branchId}:kds:all`,
          `branch:${branchId}:dispatch`,
          `branch:${branchId}:admin`
        );
        if (stationId) {
          channels.push(`branch:${branchId}:kds:${stationId}`);
        }
        break;

      case "KITCHEN_MANAGER":
        channels.push(`branch:${branchId}:kds:all`);
        if (stationId) {
          channels.push(`branch:${branchId}:kds:${stationId}`);
        }
        break;

      case "KITCHEN_EMPLOYEE":
        if (stationId) {
          channels.push(`branch:${branchId}:kds:${stationId}`);
        }
        channels.push(`branch:${branchId}:kds:all`);
        break;

      case "DELIVERY_MANAGER":
        channels.push(`branch:${branchId}:dispatch`);
        break;

      case "DRIVER":
        // Driver can only subscribe to their own driver channel
        channels.push(`branch:${branchId}:driver:me`);
        break;

      default:
        break;
    }

    return channels;
  }

  /**
   * Check if a role is authorized to subscribe to a target channel
   */
  canAccessChannel(role: Role, branchId: string, targetChannel: string, stationId?: string | null): boolean {
    const authorized = this.getAuthorizedChannels(role, branchId, stationId);
    
    // Exact match or station-level matching
    if (authorized.includes(targetChannel)) return true;

    // Kitchen roles can access specific stations within their branch
    if (
      (role === "KITCHEN_EMPLOYEE" || role === "KITCHEN_MANAGER" || role === "MANAGER" || role === "ADMIN" || role === "OWNER") &&
      targetChannel.startsWith(`branch:${branchId}:kds:`)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Issue an ephemeral, single-use connection ticket with 60-second TTL
   * (PHASE 00 Section 28: Ephemeral WebSocket Ticket Auth)
   */
  async issueTicket(params: IssueTicketParams): Promise<{ ticket: string; expiresAt: string; channel: string }> {
    const { tenantId, branchId, userId, role, stationId, ttlSeconds = 60 } = params;

    // Determine target channel
    const defaultChannel = stationId
      ? `branch:${branchId}:kds:${stationId}`
      : `branch:${branchId}:kds:all`;

    const channel = params.channel || defaultChannel;

    if (!this.canAccessChannel(role, branchId, channel, stationId)) {
      throw new Error(`Role ${role} is not authorized for channel ${channel}`);
    }

    const ticketStr = `tk_${crypto.randomBytes(24).toString("hex")}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const record = {
      ticket: ticketStr,
      tenant_id: tenantId,
      branch_id: branchId,
      user_id: userId,
      role,
      station_id: stationId || null,
      channel,
      expires_at: expiresAt,
      used_at: null,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("realtime_tickets", record);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO realtime_tickets (
          ticket, tenant_id, branch_id, user_id, role, station_id, channel, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          ticketStr,
          tenantId,
          branchId,
          userId,
          role,
          stationId || null,
          channel,
          expiresAt.toISOString(),
        ]
      );
    }

    return {
      ticket: ticketStr,
      expiresAt: expiresAt.toISOString(),
      channel,
    };
  }

  /**
   * Validate and atomically consume ticket (single-use enforcement)
   */
  async validateAndConsumeTicket(ticketStr: string): Promise<RealtimeTicketRecord> {
    if (!ticketStr) {
      throw new Error("Missing realtime ticket");
    }

    const now = new Date();

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const tickets = memoryDb.find("realtime_tickets", (t: any) => t.ticket === ticketStr);
      if (!tickets.length) {
        throw new Error("Invalid or non-existent ticket");
      }

      const ticket = tickets[0] as RealtimeTicketRecord;

      if (ticket.used_at) {
        throw new Error("Ticket has already been consumed (single-use)");
      }

      if (new Date(ticket.expires_at).getTime() < now.getTime()) {
        throw new Error("Ticket has expired");
      }

      // Mark consumed
      const updated = memoryDb.update("realtime_tickets", ticket.id, {
        used_at: now,
      });

      return updated as RealtimeTicketRecord;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `UPDATE realtime_tickets
         SET used_at = $1
         WHERE ticket = $2 AND used_at IS NULL AND expires_at > $1
         RETURNING *`,
        [now.toISOString(), ticketStr]
      );

      if (res.rowCount === 0) {
        // Check why it failed
        const check = await pool.query(`SELECT * FROM realtime_tickets WHERE ticket = $1`, [ticketStr]);
        if (check.rowCount === 0) throw new Error("Invalid or non-existent ticket");
        if (check.rows[0].used_at) throw new Error("Ticket has already been consumed (single-use)");
        if (new Date(check.rows[0].expires_at).getTime() <= now.getTime()) {
          throw new Error("Ticket has expired");
        }
        throw new Error("Ticket validation failed");
      }

      return res.rows[0] as RealtimeTicketRecord;
    }
  }
}

export const realtimeService = new RealtimeService();
