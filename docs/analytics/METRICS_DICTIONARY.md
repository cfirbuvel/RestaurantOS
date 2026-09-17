# RestaurantOS Metrics Dictionary

This document serves as the canonical single source of truth for all business, operational, and financial metrics across RestaurantOS (Phase 10 & Phase 00 ADR-0008 alignment). Every metric displayed on executive dashboards, exported in Z-reports, or fed into machine learning datasets is defined here.

---

## 1. Sales & Revenue Metrics

### 1.1 Gross Revenue (פדיון ברוטו)
- **Code Identifier**: `GROSS_REVENUE`
- **Definition**: The total sum of all order totals placed within the period, prior to discounts, refunds, or cancellations.
- **Formula**: $\sum (\text{order.total\_amount})$ for all orders where $\text{status} \neq \text{'CANCELLED'}$.
- **Source Tables**: `orders`
- **Granularity**: Tenant, Branch, Channel, Day, Hour
- **Currency**: Stored in Agorot (cents), displayed in NIS (₪)
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `ACCOUNTANT`

### 1.2 Net Revenue (פדיון נטו)
- **Code Identifier**: `NET_REVENUE`
- **Definition**: Realized revenue excluding Value Added Tax (VAT 17%), customer discounts, delivery fees, and tips.
- **Formula**: $\text{Gross Revenue} - \text{Discounts} - \text{VAT} - \text{Tips} - \text{Delivery Fees}$
- **Source Tables**: `orders`, `order_items`
- **Granularity**: Tenant, Branch, Day, Month
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `ACCOUNTANT`

### 1.3 Average Order Value (AOV / ממוצע להזמנה)
- **Code Identifier**: `AVERAGE_ORDER_VALUE`
- **Definition**: The mean monetary value of each completed or active order.
- **Formula**: $\frac{\text{Gross Revenue}}{\text{Total Valid Orders}}$
- **Source Tables**: `orders`
- **Granularity**: Tenant, Branch, Channel, Date Range
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `MARKETING_MANAGER`

### 1.4 Sales by Channel (התפלגות ערוצי מכירה)
- **Code Identifier**: `SALES_BY_CHANNEL`
- **Definition**: Revenue and order count partitioned by intake channel: `DINE_IN`, `TAKEAWAY`, `DELIVERY`, `ONLINE_WEB`, `KIOSK`, `WOLT`, `TENBIS`, `MISHLOHA`.
- **Formula**: $\text{GROUP BY channel} \rightarrow (\text{COUNT}(\text{id}), \sum(\text{total\_amount}))$
- **Source Tables**: `orders`
- **Granularity**: Tenant, Branch, Day
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`

---

## 2. Kitchen & Operations Metrics (KDS)

### 2.1 Average Preparation Time (זמן הכנה ממוצע)
- **Code Identifier**: `AVG_PREP_TIME`
- **Definition**: The average duration in minutes from when a ticket is routed to the kitchen (`QUEUED` or `PREPARING`) until marked `READY`.
- **Formula**: $\frac{\sum (\text{ready\_at} - \text{created\_at})}{\text{Total Prepared Tickets}}$
- **Source Tables**: `kds_tickets`
- **Granularity**: Tenant, Branch, Station (`GRILL`, `FRY`, `SALAD`, `ASSEMBLY`), Day, Hour
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `KITCHEN_MANAGER`

### 2.2 Kitchen SLA Exceeded Rate (אחוז חריגת SLA מטבח)
- **Code Identifier**: `KITCHEN_SLA_EXCEEDED_RATE`
- **Definition**: Percentage of kitchen tickets that took longer to prepare than their target SLA (default: 15 minutes).
- **Formula**: $\frac{\text{COUNT}(\text{prep\_time} > \text{target\_sla})}{\text{COUNT}(\text{total\_tickets})} \times 100\%$
- **Source Tables**: `kds_tickets`
- **Granularity**: Tenant, Branch, Station, Shift
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `KITCHEN_MANAGER`

### 2.3 Station Throughput (תפוקת עמדות מטבח)
- **Code Identifier**: `STATION_THROUGHPUT`
- **Definition**: Number of dishes/items completed per kitchen station per hour.
- **Formula**: $\frac{\text{COUNT}(\text{kds\_ticket\_items.completed})}{\text{Active Hours}}$
- **Source Tables**: `kds_tickets`, `kds_ticket_items`
- **Granularity**: Station, Hour
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `KITCHEN_MANAGER`

---

## 3. Delivery & Fleet Logistics Metrics

### 3.1 Average Delivery Fulfillment Time (זמן משלוח כולל)
- **Code Identifier**: `AVG_DELIVERY_TIME`
- **Definition**: Total time elapsed from order creation to physical drop-off at the customer's doorstep.
- **Formula**: $\frac{\sum (\text{delivered\_at} - \text{order.created\_at})}{\text{Total Completed Deliveries}}$
- **Source Tables**: `deliveries`, `orders`
- **Granularity**: Tenant, Branch, Hour, Day
- **Target SLA**: $\le 45\text{ minutes}$ (Urban TLV)
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `DELIVERY_MANAGER`

### 3.2 Dispatch Waiting Time (זמן המתנה לשליח)
- **Code Identifier**: `DISPATCH_WAITING_TIME`
- **Definition**: Time elapsed from order `READY` at expediter to when a driver picks it up (`PICKED_UP` / `EN_ROUTE`).
- **Formula**: $\text{picked\_up\_at} - \text{kds\_ready\_at}$
- **Source Tables**: `deliveries`, `kds_tickets`
- **Granularity**: Tenant, Branch, Day
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `DELIVERY_MANAGER`

### 3.3 Smart Batching Efficiency (יעילות איחוד משלוחים)
- **Code Identifier**: `BATCH_EFFICIENCY_RATE`
- **Definition**: Ratio of deliveries successfully batched together (2-3 orders per trip) vs single-order trips.
- **Formula**: $\frac{\text{Deliveries in Batches}}{\text{Total Deliveries}} \times 100\%$
- **Source Tables**: `delivery_batches`, `deliveries`
- **Granularity**: Branch, Day
- **Role Access**: `ORGANIZATION_ADMIN`, `DELIVERY_MANAGER`

### 3.4 Driver Utilization Rate (ניצולת שליחים)
- **Code Identifier**: `DRIVER_UTILIZATION`
- **Definition**: Percentage of active on-shift time spent actively transporting deliveries versus idle in queue.
- **Formula**: $\frac{\sum \text{Trip Durations}}{\text{Shift Clocked Hours}} \times 100\%$
- **Source Tables**: `drivers`, `vehicle_trips`
- **Granularity**: Driver, Branch, Week
- **Role Access**: `ORGANIZATION_ADMIN`, `DELIVERY_MANAGER`

---

## 4. Inventory, COGS & Waste Metrics

### 4.1 Cost of Goods Sold (COGS / עלות המכר)
- **Code Identifier**: `COGS`
- **Definition**: Total theoretical cost of raw ingredients used to fulfill completed orders based on Bill of Materials (BOM) recipes.
- **Formula**: $\sum (\text{order\_item.quantity} \times \text{recipe.ingredient\_unit\_cost})$
- **Source Tables**: `orders`, `order_items`, `recipes`, `recipe_items`, `inventory_items`
- **Granularity**: Tenant, Branch, Day, Month
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `ACCOUNTANT`

### 4.2 Food Cost Percentage (אחוז עלות מזון)
- **Code Identifier**: `FOOD_COST_PERCENTAGE`
- **Definition**: COGS expressed as a percentage of gross menu sales for food items.
- **Formula**: $\frac{\text{COGS}}{\text{Gross Food Sales}} \times 100\%$
- **Healthy Benchmark**: 28% – 34% in quick-service & casual dining
- **Source Tables**: `orders`, `recipes`, `inventory_stocks`
- **Granularity**: Tenant, Branch, Category, Month
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `ACCOUNTANT`

### 4.3 Food Waste Cost (עלות פחת ובזבוז)
- **Code Identifier**: `WASTE_COST`
- **Definition**: Monetary loss resulting from recorded spoilage, kitchen errors, drops, or expiration.
- **Formula**: $\sum (\text{waste\_record.quantity} \times \text{inventory\_item.unit\_cost})$
- **Source Tables**: `waste_records`, `inventory_items`
- **Granularity**: Tenant, Branch, Waste Reason, Week
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `KITCHEN_MANAGER`

### 4.4 Stock Variance (סטיית מלאי - תיאורטי מול נספר)
- **Code Identifier**: `STOCK_VARIANCE`
- **Definition**: Difference between expected inventory (based on automated depletion) and actual physical inventory counts.
- **Formula**: $\text{Physical Count Quantity} - \text{System Theoretical Quantity}$
- **Source Tables**: `inventory_stocks`, `stock_count_sheets`, `stock_movements`
- **Granularity**: Inventory Item, Branch, Count Cycle
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`

---

## 5. Marketing, Promotions & Loyalty Metrics

### 5.1 Coupon Redemption Rate (שיעור מימוש קופונים)
- **Code Identifier**: `COUPON_REDEMPTION_RATE`
- **Definition**: Percentage of issued or distributed coupons that resulted in completed order checkouts.
- **Formula**: $\frac{\text{Total Redemptions}}{\text{Max Usage Limit or Dispatched Count}} \times 100\%$
- **Source Tables**: `coupons`, `coupon_redemptions`
- **Granularity**: Coupon Code, Campaign, Month
- **Role Access**: `ORGANIZATION_ADMIN`, `MARKETING_MANAGER`

### 5.2 Promotion Discount Total (סה"כ הנחות מבצע)
- **Code Identifier**: `PROMOTION_DISCOUNT_TOTAL`
- **Definition**: Total monetary value absorbed as promotional price deductions across all rule-based promotions.
- **Formula**: $\sum (\text{order.discount\_amount})$
- **Source Tables**: `orders`, `promotions`
- **Granularity**: Tenant, Branch, Promotion ID, Day
- **Role Access**: `ORGANIZATION_ADMIN`, `MARKETING_MANAGER`, `ACCOUNTANT`

### 5.3 Loyalty Liability & Economy (מאזן נקודות מועדון)
- **Code Identifier**: `LOYALTY_POINTS_BALANCE`
- **Definition**: Net unredeemed loyalty points in circulation across all customers (potential financial liability).
- **Formula**: $\sum (\text{points\_earned}) - \sum (\text{points\_redeemed}) - \sum (\text{points\_expired})$
- **Source Tables**: `loyalty_accounts`, `loyalty_transactions`
- **Granularity**: Tenant, Month
- **Role Access**: `ORGANIZATION_ADMIN`, `ACCOUNTANT`

---

## 6. Financial Reconciliation & Cash Drawer (קופות וסגירת יום)

### 6.1 End of Day Z-Report (דוח Z יומי)
- **Code Identifier**: `EOD_Z_REPORT`
- **Definition**: An immutable financial snapshot produced at business day closure summarizing gross sales, tax, tips, voids, cancellations, and payment breakdowns.
- **Fields**:
  - `total_transactions`: Total orders count
  - `gross_sales`: Gross sum before deductions
  - `net_sales`: Sales net of VAT and discounts
  - `vat_collected`: Total VAT (17% statutory)
  - `discounts_total`: Sum of all coupon and promo deductions
  - `tips_total`: Credit & digital gratuities
  - `payment_breakdown`: Itemized sum by `CASH`, `CREDIT_CARD`, `WOLT_PAY`, `TENBIS_PAY`, `CIBUS`
  - `refunds_total`: Sum of refunded/voided transactions
- **Source Tables**: `orders`, `cash_drawer_sessions`, `payments`
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `ACCOUNTANT`

### 6.2 Cash Drawer Variance (הפרש קופה)
- **Code Identifier**: `CASH_DRAWER_VARIANCE`
- **Definition**: Discrepancy between actual cash physically counted in the register and expected cash calculated by the POS.
- **Formula**: $\text{Actual Counted Cash} - (\text{Opening Float} + \text{Cash Sales} + \text{Cash In} - \text{Cash Out/Drops})$
- **Source Tables**: `cash_drawer_sessions`
- **Granularity**: Terminal / POS Station, Shift, Day
- **Acceptable Tolerance**: $\pm 5\text{ ILS}$
- **Role Access**: `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `ACCOUNTANT`

---

## 7. Machine Learning & Decision Intelligence Metrics (Phase 00 Alignment)

### 7.1 Advisory Recommendation Approval Rate (שיעור אישור המלצות חכמות)
- **Code Identifier**: `DECISION_APPROVAL_RATE`
- **Definition**: The proportion of automated AI/heuristic suggestions (such as smart batching or prep-time predictions) accepted without change by human dispatchers.
- **Formula**: $\frac{\text{COUNT}(\text{action} = \text{'APPROVED'})}{\text{COUNT}(\text{total\_decisions\_logged})} \times 100\%$
- **Source Tables**: `intelligence_decision_logs`
- **Granularity**: Algorithm Version, Day, Week
- **Role Access**: `ORGANIZATION_ADMIN`, `ENGINEER`

### 7.2 Human Override Frequency (תדירות עקיפה אנושית)
- **Code Identifier**: `DECISION_OVERRIDE_RATE`
- **Definition**: Frequency with which dispatchers or kitchen managers explicitly rejected or overrode system suggestions, used as primary negative signal for Gen 2 model retraining.
- **Formula**: $\frac{\text{COUNT}(\text{action} \in [\text{'REJECTED'}, \text{'OVERRIDDEN'}])}{\text{COUNT}(\text{total\_decisions\_logged})} \times 100\%$
- **Source Tables**: `intelligence_decision_logs`
- **Granularity**: Decision Type (`BATCH_OFFER`, `DRIVER_ASSIGNMENT`, `PREP_PACING`), Algorithm Version
- **Role Access**: `ORGANIZATION_ADMIN`, `ENGINEER`
