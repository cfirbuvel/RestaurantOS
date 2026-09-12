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

# INVENTORY EVENTS

Sale
→ Recipe calculation
→ Inventory deduction
→ Stock movement
→ Audit event

Support rollback/correction where appropriate.

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