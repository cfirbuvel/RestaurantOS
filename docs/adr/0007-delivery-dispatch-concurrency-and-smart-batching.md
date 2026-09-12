# ADR 0007: Delivery Dispatch Concurrency, Driver Queue & Smart Batching Architecture

**Status:** Accepted (Amended)  
**Date:** 2026-09-12  
**Deciders:** Lead Systems Architect, Logistics Domain Architect  

---

## Context
In high-volume restaurant delivery operations, multiple drivers may simultaneously attempt to self-assign the same assignable delivery or batch. Furthermore, delivery batching based solely on geographic distance produces severe delays when orders require travel in diverging directions or have misaligned kitchen preparation times. We must establish a bulletproof concurrency model, a deterministic driver queue, and an advisory smart batching engine.

## Decision
We establish the following foundational architectural decisions for Delivery Management:

1. **Independent Delivery State Machine:**
   - Deliveries exist only for orders requiring delivery transport and follow an independent lifecycle:
     $$\text{WAITING} \rightarrow \text{PREPARING} \rightarrow \text{READY} \rightarrow \text{AVAILABLE\_FOR\_ASSIGNMENT} \rightarrow \text{ASSIGNED} \rightarrow \text{PICKED\_UP} \rightarrow \text{OUT\_FOR\_DELIVERY} \rightarrow \text{ARRIVED\_AT\_CUSTOMER\_AREA} \rightarrow \text{DELIVERED}$$
   - When a delivery is released by a driver prior to pickup, it transitions safely back to `AVAILABLE_FOR_ASSIGNMENT`.

2. **Deterministic Driver Availability Queue:**
   - Queue priority is determined strictly by `available_since ASC` (server-generated timestamp). Queue position is a derived projection, never stored as static state.
   - Distinct lifecycle transitions update `available_since`:
     - Clock-in -> sets `available_since = NOW()`.
     - Return from Break (`DriverReturnedFromBreak`) -> sets `available_since = NOW()` (joins end of FIFO queue).
     - Physical Return to Restaurant (`DriverReturnedToRestaurant`) -> sets `available_since = NOW()` (joins end of FIFO queue).
     - Released Assignment -> retains original or resets `available_since` based on branch policy.

3. **Atomic Concurrency Protection & Assignment Sources:**
   - Delivery self-assignment executes via atomic conditional SQL queries:
     ```sql
     UPDATE deliveries 
     SET driver_id = $driverId, vehicle_id = $vehicleId, status = 'ASSIGNED', updated_at = NOW(), version = version + 1
     WHERE id = $deliveryId AND status = 'AVAILABLE_FOR_ASSIGNMENT' AND driver_id IS NULL;
     ```
   - High-contention batch assignments utilize Redis distributed locks (Redlock). Exactly one driver succeeds; concurrent requests receive `409 Conflict (DELIVERY_ALREADY_ASSIGNED)`.
   - Assignment sources are explicitly tracked: `MANAGER`, `DRIVER_SELF_ASSIGN`, `SYSTEM_RECOMMENDATION`, `FUTURE_AGENT`.

4. **Strategy Pattern for Delivery Assignment Engine:**
   - Single authoritative engine supporting pluggable strategies: `FIFOAssignmentStrategy`, `FIFOAreaAssignmentStrategy`, `SmartRecommendationStrategy`, `FutureAgentAssignmentStrategy`.
   - Branch policies: `FIFO`, `FIFO_WITH_AREA`, `SMART_RECOMMENDATION`, `MANAGER_ONLY`.

5. **Deterministic Gen 1 Smart Batching Heuristic:**
   - Evaluates candidate orders across:
     $$\text{BatchScore} = w_1 \cdot \text{DistanceScore} + w_2 \cdot \text{AzimuthAlignment} + w_3 \cdot \text{KitchenSync} + w_4 \cdot \text{SLAHeadroom} + w_5 \cdot \text{VehicleCapacity}$$
   - Gen 1 uses deterministic coordinate math. Gen 2 will incorporate road network matrices, live traffic, and ML predictions.
   - Batches require explicit human Manager Approval (`APPROVE`, `REJECT`, `MODIFY`, `FORCE`) before dispatch.
   - All batch recommendations, human actions, and delivery outcomes are recorded in `intelligence_decision_logs`.

## Consequences
- **Positive:** Mathematically impossible to produce duplicate driver assignments; zero kitchen-delivery state confusion; full auditability and decision telemetry for future ML training.
- **Negative:** Requires strict database transaction boundaries and server-authoritative timestamping.
