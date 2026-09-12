import { memoryDb, getPostgresPool } from "../database/db";
import { getRedisClient } from "../cache/redis";

export interface EventActor {
  actorId: string;
  actorType: "USER" | "SYSTEM" | "INTEGRATION" | "DEVICE";
}

export interface DomainEvent<T = any> {
  eventId: string;
  eventType: string;
  version: string;
  timestamp: string;
  tenantId: string;
  restaurantId?: string;
  branchId?: string;
  correlationId: string;
  causationId?: string;
  actor: EventActor;
  payload: T;
}

export type EventHandler<T = any> = (event: DomainEvent<T>) => Promise<void> | void;

export class EventBus {
  private handlers: Map<string, Array<EventHandler>> = new Map();

  /**
   * Subscribe an in-process handler for an event type
   */
  subscribe<T = any>(eventType: string, handler: EventHandler<T>) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler);
  }

  /**
   * Record domain event to transactional outbox and dispatch immediately to in-memory listeners
   */
  async publish<T = any>(eventInput: Omit<DomainEvent<T>, "eventId" | "version" | "timestamp"> & {
    eventId?: string;
    version?: string;
    timestamp?: string;
  }): Promise<DomainEvent<T>> {
    const event: DomainEvent<T> = {
      eventId: eventInput.eventId || crypto.randomUUID(),
      eventType: eventInput.eventType,
      version: eventInput.version || "1.0",
      timestamp: eventInput.timestamp || new Date().toISOString(),
      tenantId: eventInput.tenantId,
      restaurantId: eventInput.restaurantId,
      branchId: eventInput.branchId,
      correlationId: eventInput.correlationId,
      causationId: eventInput.causationId,
      actor: eventInput.actor,
      payload: eventInput.payload,
    };

    // 1. Transactional Outbox Persistence
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("outbox_events", {
        event_id: event.eventId,
        event_type: event.eventType,
        version: event.version,
        tenant_id: event.tenantId,
        restaurant_id: event.restaurantId,
        branch_id: event.branchId,
        actor_id: event.actor.actorId,
        payload: event.payload,
        correlation_id: event.correlationId,
        causation_id: event.causationId,
        published: false,
        retry_count: 0,
      });
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO outbox_events (
          event_id, event_type, version, tenant_id, restaurant_id, branch_id,
          actor_id, payload, correlation_id, causation_id, published, retry_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, 0)`,
        [
          event.eventId,
          event.eventType,
          event.version,
          event.tenantId,
          event.restaurantId || null,
          event.branchId || null,
          event.actor.actorId,
          JSON.stringify(event.payload),
          event.correlationId,
          event.causationId || null,
        ]
      );
    }

    // 2. Dispatch to local subscribers
    const localListeners = this.handlers.get(event.eventType) || [];
    for (const handler of localListeners) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Error in local event handler for ${event.eventType}:`, err);
      }
    }

    // 3. Publish to Redis channel for multi-instance distribution
    const redis = getRedisClient();
    const channel = `events:${event.tenantId}:${event.eventType}`;
    await redis.publish(channel, JSON.stringify(event));

    return event;
  }
}

export const eventBus = new EventBus();
