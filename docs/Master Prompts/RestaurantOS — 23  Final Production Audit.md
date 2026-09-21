# RestaurantOS — Prompt 23

## Final Product Surface and Implementation Truth Audit

This is a verification phase.

Do not implement major features.

Do not rewrite code.

Do not mark anything complete based only on documentation.

The purpose is to compare documented status against actual repository evidence.

---

# 1. Build a Product Surface Matrix

Create:

`docs/PRODUCT_SURFACE_MATRIX.md`

Columns:

| Capability | Backend | API | Web UI | Manager App | Driver App | KDS | Kiosk | Customer Web | Tests | Documentation |
| ---------- | ------- | --- | ------ | ----------- | ---------- | --- | ----- | ------------ | ----- | ------------- |

Populate using actual repository evidence.

---

# 2. Important Rule

"Complete" means:

The user-facing capability exists and can actually be used.

Do NOT mark a feature complete merely because:

* database tables exist
* API exists
* domain service exists
* documentation exists
* mock exists

Differentiate:

* Planned
* Architecture Ready
* Backend Complete
* API Complete
* UI Complete
* Integration Complete
* Tested
* Production Ready

---

# 3. Audit These Capabilities

At minimum:

* Authentication
* Multi-tenancy
* Branch management
* Orders
* Customers
* Delivery
* Driver management
* Driver Android
* Fleet
* Tracker
* KDS
* KDS UI
* Manager Web
* Manager Android
* Kiosk
* Customer Website
* Payments
* Inventory
* Promotions
* Loyalty
* Telephony
* Analytics
* Reporting
* Notifications
* Integrations
* Security
* Audit logs
* Realtime
* Offline behavior

---

# 4. Evidence

For every completed capability record:

* implementation path
* API path
* UI path
* relevant tests
* documentation

Do not invent evidence.

---

# 5. Identify False Completeness

Find features currently marked as completed but missing a required user-facing layer.

Examples:

```text
Backend complete
but
UI missing
```

or:

```text
API complete
but
mobile client missing
```

or:

```text
UI exists
but
critical workflow is not connected
```

---

# 6. Final Status

Create a concise executive summary:

### Actually Complete

### Partially Complete

### Backend Only

### UI Missing

### Integration Missing

### Needs Testing

### Future

---

# 7. No Scope Creep

Do not implement every missing item automatically.

This phase is an evidence audit.

Produce a prioritized list of the next implementation phases based on actual gaps.

Do not assign subjective "best/worst" rankings.

---

# Definition of Done

RestaurantOS has a truthful, evidence-based product status.

Documentation matches the actual repository.

No backend-only capability is incorrectly represented as a fully completed product feature.
