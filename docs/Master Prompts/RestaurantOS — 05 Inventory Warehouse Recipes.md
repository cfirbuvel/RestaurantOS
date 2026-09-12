# RestaurantOS — Phase 5: Inventory, Warehouse, Suppliers and Recipes

Implement the complete inventory system.

---

# CORE

Implement:

Products
Ingredients
Units
Warehouses
Storage locations
Suppliers
Purchase Orders
Goods Receiving
Stock Movements
Transfers
Counts
Adjustments
Waste
Expiration
Minimum Stock
Reorder Points

---

# RECIPES / BOM

Products can consume ingredients.

Example:

Pizza Margherita:

350g dough
250g cheese
120g sauce

When one pizza is sold:

deduct corresponding inventory quantities.

---

# INVENTORY TIMING & DEPLETION POLICY (PHASE 00 Section 34)

Inventory deduction timing must NEVER be implicit. Model it as a configurable branch/restaurant business policy:

Supported Policies:
1. `ON_ACCEPTED` (Canonical Default): Deducts inventory immediately when an order is accepted to guarantee ingredients are committed.
2. `ON_PREPARATION_START`: Deducts inventory when kitchen begins preparing (`STARTED`).
3. `ON_FULFILLMENT`: Deducts inventory when order is ready / delivered.

Event Flow:
Trigger (based on active policy)
→ Recipe calculation (BOM explosion)
→ Inventory deduction
→ Stock movement record
→ Audit event

Support automatic inventory restoration/rollback upon order cancellation where appropriate.

---

# WAREHOUSES

Support:

Main warehouse
Kitchen
Freezer
Branch warehouse

Support transfers.

---

# STOCK SAFETY

Prevent:

negative inventory unless explicitly configured
unauthorized adjustments
duplicate receiving
duplicate deductions

Use idempotency.

---

# SUPPLIERS

Store:

supplier
products
cost
minimum order
lead time
supplier SKU

---

# FUTURE

Prepare architecture for:

- demand forecasting
- AI purchasing recommendations
- automatic purchase orders

Do not autonomously order inventory in Gen 1.

---

# TESTING

Automated:

- receiving
- deduction
- transfer
- waste
- adjustment
- recipe calculation
- concurrency
- rollback
- tenant isolation
- permissions

Manual testing document:

/docs/testing/manual/INVENTORY_MANUAL_TEST.md