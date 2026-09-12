# ADR 0005: Event-Driven Architecture & Transactional Outbox Pattern

**Status:** Accepted  
**Date:** 2026-09-09  
**Deciders:** Lead Systems Architect  

---

## Context
When operational events occur (e.g. `OrderReady`, `DriverAssigned`, `InventoryAdjusted`), multiple downstream consumers must react immediately (real-time WebSocket UI updates, SMS notifications, inventory depletion, analytics). Publishing events directly to an external message broker inside an HTTP request risks dual-write inconsistency if the database commit fails or the network drops.

## Decision
1. Implement the **Transactional Outbox Pattern**: Every domain entity change and its corresponding typed domain event are saved into PostgreSQL within the same atomic database transaction.
2. A lightweight background worker polls/listens to `outbox_events` and publishes them to Redis Pub/Sub.
3. Every event carries mandatory metadata: `event_id`, `event_type`, `version`, `timestamp`, `tenant_id`, `branch_id`, `actor_id`, `correlation_id`, `causation_id`, and `payload`.
4. Event consumers enforce idempotency using `correlation_id` / `event_id` tracking.

## Consequences
- **Positive:** Guaranteed at-least-once event delivery, zero data inconsistency, fully traceable event causality graph, and decoupled bounded contexts.
- **Negative:** Minor latency (typically 5–50ms) introduced by the outbox relay poller.
