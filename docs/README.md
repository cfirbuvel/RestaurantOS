# RestaurantOS — Master Architecture & Documentation Hub

Welcome to **RestaurantOS**, an enterprise-grade, modular, multi-tenant Restaurant Operating System designed to power single-location restaurants, multi-branch eateries, cafes, pizzerias, burger joints, sushi bars, dark kitchens, and enterprise dining chains.

---

## 📖 Master Documentation Index

| Document | Description | Status |
| :--- | :--- | :--- |
| [PROJECT_AUDIT.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/PROJECT_AUDIT.md) | Initial repository state, technology audit, and baseline risk assessment. | `Approved` |
| [ARCHITECTURE.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/ARCHITECTURE.md) | High-level system architecture, bounded contexts, domain models, and data flows. | `Amended & Approved` |
| [PRODUCT_REQUIREMENTS.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/PRODUCT_REQUIREMENTS.md) | Detailed functional & operational requirements across all 44 core modules. | `Amended & Approved` |
| [API.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/API.md) | Universal API contracts, explicit domain commands, ticket-based WebSockets, and SSE. | `Amended & Approved` |
| [EVENTS.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/EVENTS.md) | Canonical Master Domain Event Catalog across all aggregates and bounded contexts. | `Approved` |
| [DATABASE.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/DATABASE.md) | Database topology, multi-tenancy RLS isolation, telemetry retention, and indexing. | `Amended & Approved` |
| [database/SCHEMA.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/database/SCHEMA.md) | Comprehensive PostgreSQL DDL schema definitions (including fleet, vehicles, trackers). | `Amended & Approved` |
| [SECURITY.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/SECURITY.md) | Security policies, threat model, compliance posture, and telemetry privacy standards. | `Amended & Approved` |
| [security/SECURITY_ARCHITECTURE.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/security/SECURITY_ARCHITECTURE.md) | RBAC hierarchy, tenant boundaries, cryptographic webhooks, and restricted driver DTOs. | `Amended & Approved` |
| [TESTING.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/TESTING.md) | Testing pyramid overview, test execution matrix, and verification standards. | `Approved` |
| [testing/TESTING_STRATEGY.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/testing/TESTING_STRATEGY.md) | Detailed automated test specifications, race-condition suites, and manual checklists. | `Amended & Approved` |
| [DEPLOYMENT.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/DEPLOYMENT.md) | Multi-stage Docker containers, Kubernetes topologies, CI/CD pipeline, and rollouts. | `Approved` |
| [OPERATIONS.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/OPERATIONS.md) | Observability, health probes, Prometheus/Grafana dashboards, runbooks, and DR plans. | `Approved` |
| [OPERATIONAL_GUIDE.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/OPERATIONAL_GUIDE.md) | Master end-to-end step-by-step operational guide: restaurant opening, KDS, dispatch, closing. | `Approved` |
| [INTEGRATIONS.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/INTEGRATIONS.md) | Integration Hub specifications (Wolt, 10bis, Invoicing, Payments, Trackers, PBX). | `Amended & Approved` |
| [ROADMAP.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/ROADMAP.md) | Phased implementation roadmap from Gen 1 (Human-operated) to Gen 5 (Autonomous AI). | `Amended & Approved` |
| [IMPLEMENTATION_STATUS.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/IMPLEMENTATION_STATUS.md) | Master traceability matrix tracking module completion, test pass rates, and security sign-off. | `Amended (Phase 0 Ready)` |
| [PHASE_0_CONTRACT_ALIGNMENT_REPORT.md](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/PHASE_0_CONTRACT_ALIGNMENT_REPORT.md) | Comprehensive Phase 0 audit and consistency validation sign-off report. | `Approved` |

---

## 🏛️ Architecture Decision Records (ADRs)

All core architectural decisions are recorded in `/docs/adr/`:

1. [ADR 0001: Architectural Decision Records](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0001-record-architecture-decisions.md)
2. [ADR 0002: Core Technology Stack & Framework Selection](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0002-technology-stack-selection.md)
3. [ADR 0003: Multi-Tenancy Architecture & Row-Level Security Isolation](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0003-multi-tenancy-and-data-isolation.md)
4. [ADR 0004: Universal Order Model & Independent Order Lifecycle](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0004-universal-order-model-and-state-machine.md)
5. [ADR 0005: Event-Driven Architecture & Transactional Outbox Pattern](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0005-event-driven-architecture-and-transactional-outbox.md)
6. [ADR 0006: Integration Hub Provider-Adapter Pattern](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0006-integration-hub-provider-adapter-pattern.md)
7. [ADR 0007: Delivery Dispatch Concurrency, Driver Queue & Smart Batching Architecture](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0007-delivery-dispatch-concurrency-and-smart-batching.md)
8. [ADR 0008: Generation 1 Human-Operated Boundary & Future AI Scaffolding](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0008-gen1-human-operated-and-future-ai-scaffolding.md)
9. [ADR 0009: Vehicle Fleet Tracking & Telemetry Architecture](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0009-vehicle-fleet-tracking-and-telemetry-architecture.md)

---

## 💡 Core Product & Architectural Guarantees

1. **Generation 1 is 100% Human-Operated:** No autonomous AI agents operate in the critical execution path. All smart batch recommendations, dispatch decisions, and inventory reorders require explicit human approval.
2. **Strict Separation of Order vs Delivery Lifecycles:** Order status represents customer purchase & kitchen preparation (`DRAFT` $\rightarrow$ `CONFIRMED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `IN_PREPARATION` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`); Delivery status represents transport logistics independently.
3. **First-Class Fleet & Telematics Domain:** Vehicles, IoT Trackers, Driver-Vehicle Assignments, and Vehicle-Tracker Assignments are independent first-class entities with hardware-agnostic adapter abstractions.
4. **Deterministic Concurrency & Auditability:** Driver availability queues are ordered strictly by `available_since ASC`. Self-assignments use atomic database row locks.
5. **Telemetry $\neq$ Business Truth:** GPS geofence arrival provides physical proximity evidence but never automatically completes a business delivery without human/driver verification.
