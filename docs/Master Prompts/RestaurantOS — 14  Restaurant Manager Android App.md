# RestaurantOS — Prompt 14

## Restaurant Manager Android App — Foundation + MVP

Continue from the existing RestaurantOS repository.

IMPORTANT:

Do NOT restart the project.
Do NOT rewrite the existing web application.
Do NOT duplicate backend business logic.
Do NOT modify completed backend functionality unless required to expose a missing contract.
Do NOT return to Phase 0.

This phase introduces the first native mobile client:

# RestaurantOS Manager

Android-first native application for restaurant managers and authorized staff.

The app must consume the existing RestaurantOS APIs and realtime infrastructure.

---

# 1. Inspect Existing System

Before implementation inspect:

* authentication
* users
* roles
* permissions
* branches
* orders
* deliveries
* drivers
* KDS
* notifications
* realtime
* analytics
* existing UI
* API contracts

Create:

`docs/MANAGER_APP_AUDIT.md`

Identify reusable APIs and missing endpoints.

---

# 2. Technology Decision

Evaluate the existing repository and select the most appropriate Android architecture.

Preferred:

Flutter, unless the repository already establishes a strong native Android architecture that should be preserved.

The application must be Android-first.

Architecture must allow future iOS support.

Use:

* clean separation between presentation/domain/data
* typed API models
* secure token storage
* offline-aware state
* realtime subscriptions
* push notifications
* centralized error handling

Do not over-engineer.

---

# 3. Application Structure

Create:

```text
Manager App
|
+-- Authentication
|
+-- Branch Selection
|
+-- Dashboard
|
+-- Orders
|
+-- Deliveries
|
+-- Drivers
|
+-- KDS Overview
|
+-- Customers
|
+-- Notifications
|
+-- Quick Actions
|
+-- Settings
```

---

# 4. Manager Dashboard

Dashboard should prioritize live operations.

Display:

* today's orders
* active orders
* orders requiring attention
* active deliveries
* waiting deliveries
* available drivers
* busy drivers
* KDS status
* SLA warnings
* operational alerts

Do not overload the first screen with analytics.

The dashboard is an operational control center.

---

# 5. Orders

Manager can:

* view orders
* filter
* inspect order
* see status
* see customer
* see payment
* see delivery/pickup
* see preparation state
* cancel where permitted
* perform authorized operational actions

All actions must use existing server-side domain commands.

---

# 6. Deliveries

Manager can:

* view delivery queue
* view ready deliveries
* view assigned deliveries
* see available drivers
* assign driver
* reassign
* release
* inspect batching recommendation
* approve recommendation
* reject recommendation
* override assignment where permitted

Show the reason for system recommendations.

For Gen 1, recommendation remains deterministic and manager-approved.

No autonomous assignment.

---

# 7. Driver Management

Display:

* ON_SHIFT
* OFF_SHIFT
* BREAK
* AVAILABLE
* ASSIGNED
* IN_TRANSIT
* RETURNING

Show:

* current assignment
* available_since
* vehicle
* tracker status where available
* last known location where authorized

Respect privacy and shift-scoped location rules.

---

# 8. KDS Overview

The manager application should NOT replace the dedicated KDS.

It should provide an overview:

* station health
* active tickets
* overdue tickets
* blocked tickets
* SLA warnings

Allow manager actions only where existing permissions permit.

---

# 9. Notifications

Implement push notifications for important operational events.

Examples:

* delivery overdue
* no available driver
* KDS SLA breach
* failed integration
* payment issue
* operational alert

Notifications must be actionable.

Example:

```text
Delivery #482 is overdue

[Open Delivery]
```

---

# 10. Realtime

Use existing RestaurantOS realtime infrastructure.

The application should update:

* orders
* deliveries
* driver status
* KDS alerts
* notifications

without requiring manual refresh.

Implement reconnect behavior.

---

# 11. Offline

Manager app must gracefully handle temporary connectivity loss.

At minimum:

* show connection state
* cache last known read-only operational data
* prevent unsafe stale writes
* queue only explicitly safe/idempotent actions
* reconcile after reconnect

Do NOT blindly queue destructive actions.

---

# 12. Security

Implement:

* secure token storage
* automatic session expiration
* logout
* device/session handling
* permission-aware UI
* no sensitive data in logs
* certificate/security best practices where appropriate

Backend remains authoritative.

---

# 13. Accessibility and RTL

The application is primarily for Israeli restaurants.

Support:

* Hebrew
* RTL
* English fallback
* WCAG-conscious touch targets
* readable typography
* high contrast
* large operational status indicators

Target touch areas of at least 48dp.

---

# 14. Testing

Implement:

### Unit

* state management
* permission handling
* API parsing
* error handling

### Integration

* login
* branch selection
* order loading
* delivery assignment
* realtime updates

### Widget/UI

* dashboard
* order details
* delivery assignment
* driver list
* notifications

### Manual test matrix

Test:

* slow network
* offline
* reconnect
* expired session
* unauthorized action
* rapid realtime updates
* duplicate action
* different manager roles

---

# 15. Documentation

Create:

`docs/MANAGER_APP.md`

Include:

* architecture
* navigation
* authentication
* API
* realtime
* permissions
* offline behavior
* notifications
* build instructions

Update:

`docs/IMPLEMENTATION_STATUS.md`

Only mark implemented features as complete.

---

# Definition of Done

A functional Android Manager MVP exists.

A manager can:

1. log in
2. select branch
3. see operational dashboard
4. inspect orders
5. inspect deliveries
6. view driver state
7. perform authorized delivery actions
8. receive realtime updates
9. receive operational notifications
10. work safely through temporary connectivity loss

Existing Web functionality must continue working.

Run all relevant tests and provide an evidence-based completion report.
