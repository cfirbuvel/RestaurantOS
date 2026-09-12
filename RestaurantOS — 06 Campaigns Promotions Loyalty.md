# RestaurantOS — Phase 6: Campaigns, Promotions, Coupons and Loyalty

Implement the marketing engine.

---

# CAMPAIGNS

Campaign types:

- first order
- one-time coupon
- returning customer
- birthday
- win-back
- VIP
- referral
- free delivery
- percentage discount
- fixed discount
- free item
- 1+1
- product-specific
- category-specific
- branch-specific
- channel-specific
- delivery-zone-specific

---

# COUPONS

Implement:

- unique codes
- reusable codes
- one-time codes
- customer-specific codes
- expiration
- activation date
- usage limits
- per-customer limits
- global limits
- minimum order
- maximum discount

---

# FIRST ORDER

Define precisely what counts as:

First order
Cancelled first order
Failed payment
Refunded order

Prevent basic coupon abuse.

Use legitimate signals such as:

customer account
verified phone
order history

Do not collect unnecessary sensitive data.

---

# SEGMENTATION

Support segments based on:

- order count
- total spend
- last order
- frequency
- location
- branch
- products purchased
- customer status

---

# PROMOTION ENGINE

Implement a deterministic rule engine.

Rules must be explainable.

Example:

IF customer.first_order = true
AND order.total >= 100
THEN discount = 20%

---

# CONFLICT RESOLUTION

Support:

- promotion stacking
- mutually exclusive campaigns
- priority
- maximum discount
- campaign limits

---

# FUTURE AI

Prepare interfaces for:

AI campaign recommendations
Customer churn prediction
Next-best-offer
Campaign optimization

Do not autonomously launch campaigns in Gen 1.

---

# TESTING

Automated tests:

- coupon validation
- expiration
- usage limits
- stacking
- conflicts
- first-order logic
- refunds
- cancellations
- abuse prevention
- permissions
- tenant isolation

Manual:

/docs/testing/manual/CAMPAIGNS_MANUAL_TEST.md