# RestaurantOS — Stock Depletion & Rollback Policies

## 1. Configurable Depletion Policies (PHASE 00 Section 34)
RestaurantOS supports three configurable stock depletion policies selectable at the branch operational level:

| Policy | Trigger Event | Use Case | Rationale |
|---|---|---|---|
| `ON_ACCEPTED` *(Canonical Default)* | `OrderConfirmed` | Fast Food, Ghost Kitchens, High-Volume Delivery | Deducts immediately upon order acceptance to reserve raw ingredients and prevent over-committing out-of-stock items. |
| `ON_PREPARATION_START` | `KdsTicketStarted` | Dine-in, Steakhouses, Custom Made-to-Order | Depletes when the line cook bumps the KDS ticket to active prep, avoiding premature deductions for orders placed ahead of time. |
| `ON_FULFILLMENT` | `OrderCompleted` / `DeliveryDispatched` | Retail Bakeries, Pre-packaged Buffets | Depletes when physical goods are packed and handed over to customer or delivery courier. |

## 2. Automatic Cancellation Rollback
When an order is cancelled prior to completion (`OrderCancelled` event):
1. The inventory engine queries all `SALE_DEPLETION` movements recorded for the order.
2. For every depletion movement, an atomic `SALE_ROLLBACK` stock movement is executed, returning the exact quantities back into the kitchen warehouse.
3. An audit log entry is written documenting the restoration.

## 3. Idempotency & Concurrency Safety
Every automated depletion uses an idempotency key constructed as:
`deplete_{orderId}_{itemId}_{ingredientId}_{trigger}`

If a network retry or duplicate event occurs, the system skips the duplicate deduction and returns the existing stock movement without decrementing stock twice.
