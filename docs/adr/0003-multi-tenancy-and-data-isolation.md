# ADR 0003: Multi-Tenancy Architecture & Row-Level Security Isolation

**Status:** Accepted  
**Date:** 2026-09-09  
**Deciders:** Lead Systems Architect, Security Officer  

---

## Context
RestaurantOS is a multi-tenant SaaS that must support independent dining brands and restaurant chains without data leakage. We evaluated three multi-tenancy models:
1. Database-per-tenant
2. Schema-per-tenant
3. Shared Database / Shared Schema with Row-Level Security (RLS)

## Decision
We choose **Shared Database / Shared Schema with PostgreSQL Row-Level Security (RLS)**:
1. Every tenant-owned table contains mandatory non-nullable `tenant_id` (UUID referencing `organizations.id`) and optional `branch_id` (UUID referencing `branches.id`).
2. PostgreSQL RLS policies are enabled on all tenant tables, checking `current_setting('app.current_tenant_id', true)`.
3. Application middleware injects session tenant variables onto every checked-out database connection before query execution.

## Consequences
- **Positive:** Low operational infrastructure cost, instant onboarding of new tenants, simple database schema migrations across the entire fleet, and database-level mathematical isolation.
- **Negative:** Requires strict connection pool session cleanup (`RESET ALL` or localized transaction settings) to prevent connection state leakage.
