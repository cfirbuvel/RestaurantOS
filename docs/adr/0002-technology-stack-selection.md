# ADR 0002: Core Technology Stack & Framework Selection

**Status:** Accepted  
**Date:** 2026-09-09  
**Deciders:** Lead Systems Architect  

---

## Context
RestaurantOS requires a high-performance, type-safe, reactive architecture supporting real-time operational surfaces (KDS digital ticket rails, live dispatch consoles, driver mobile queues, and POS cash registers) alongside public-facing SEO-optimized web ordering and administrative enterprise backoffices.

## Decision
We select the following unified technology stack:
1. **Language & Runtime:** TypeScript on Node.js (v20+ LTS).
2. **Web Framework & UI Layer:** Next.js 15 (React 19, Tailwind CSS, Shadcn/UI, Lucide icons, Framer Motion) providing server-side rendering for public SEO storefronts and ultra-fast client-side reactive components for operational portals.
3. **Primary Database:** PostgreSQL 16+ with PostGIS / GiST spatial indexing for delivery geometry and native Row-Level Security (RLS).
4. **Caching & Real-Time Message Plane:** Redis 7+ for low-latency session storage, Pub/Sub event broadcasting, and Redlock distributed locks.
5. **ORM / Persistence:** Prisma ORM / Drizzle ORM with strict type generation and transactional safety.
6. **Testing Suite:** Vitest / Jest (Unit & Integration), Supertest (API Contracts), and Playwright (Multi-device E2E).

## Consequences
- **Positive:** Single language across frontend, backend, and domain models; instant TypeScript type sharing; rich ecosystem for payment SDKs and hardware integrations.
- **Negative:** Requires rigorous discipline to maintain modular domain boundaries in a unified codebase.
