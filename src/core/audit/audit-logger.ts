import { memoryDb, getPostgresPool } from "../database/db";

export interface AuditActor {
  actorId: string;
  actorType: "USER" | "SYSTEM" | "DEVICE" | "INTEGRATION";
}

export interface AuditLogEntry {
  organizationId?: string;
  restaurantId?: string;
  branchId?: string;
  actor: AuditActor;
  action: string;
  entity: string;
  entityId: string;
  previousState?: Record<string, any> | null;
  newState?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, any> | null;
}

const REDACTED_KEYS = new Set([
  "password",
  "password_hash",
  "pin",
  "pin_code_hash",
  "token",
  "secret",
  "api_key",
  "credit_card",
  "cvv",
]);

export function sanitizeAuditData(data: any): any {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeAuditData);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class AuditLogger {
  async log(entry: AuditLogEntry): Promise<any> {
    const cleanPrevious = sanitizeAuditData(entry.previousState);
    const cleanNew = sanitizeAuditData(entry.newState);

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.insert("audit_logs", {
        organization_id: entry.organizationId,
        restaurant_id: entry.restaurantId,
        branch_id: entry.branchId,
        actor_id: entry.actor.actorId,
        actor_type: entry.actor.actorType,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId,
        previous_state: cleanPrevious,
        new_state: cleanNew,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        request_id: entry.requestId,
        metadata: entry.metadata ? sanitizeAuditData(entry.metadata) : null,
      });
    }

    const pool = getPostgresPool();
    const cleanMetadata = entry.metadata ? sanitizeAuditData(entry.metadata) : null;
    const { rows } = await pool.query(
      `INSERT INTO audit_logs (
        organization_id, restaurant_id, branch_id, actor_id, actor_type,
        action, entity, entity_id, previous_state, new_state,
        ip_address, user_agent, request_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        entry.organizationId || null,
        entry.restaurantId || null,
        entry.branchId || null,
        entry.actor.actorId,
        entry.actor.actorType,
        entry.action,
        entry.entity,
        entry.entityId,
        cleanPrevious ? JSON.stringify(cleanPrevious) : null,
        cleanNew ? JSON.stringify(cleanNew) : null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.requestId || null,
        cleanMetadata ? JSON.stringify(cleanMetadata) : null,
      ]
    );

    return rows[0];
  }

  async getAuditTrail(organizationId: string, entity?: string, entityId?: string): Promise<any[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find("audit_logs", (log) => {
        if (log.organization_id && log.organization_id !== organizationId) return false;
        if (entity && log.entity !== entity) return false;
        if (entityId && log.entity_id !== entityId) return false;
        return true;
      });
    }

    const pool = getPostgresPool();
    let query = "SELECT * FROM audit_logs WHERE organization_id = $1";
    const params: any[] = [organizationId];

    if (entity) {
      params.push(entity);
      query += ` AND entity = $${params.length}`;
    }
    if (entityId) {
      params.push(entityId);
      query += ` AND entity_id = $${params.length}`;
    }

    query += " ORDER BY created_at DESC LIMIT 100";
    const { rows } = await pool.query(query, params);
    return rows;
  }
}

export const auditLogger = new AuditLogger();
