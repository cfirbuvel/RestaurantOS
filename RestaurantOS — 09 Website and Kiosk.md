# RestaurantOS — Phase 9: Customer Ordering Channels

Implement:

1. Restaurant website ordering
2. Kiosk ordering
3. Shared checkout infrastructure

---

# WEBSITE

Public restaurant pages must support:

- menu
- categories
- products
- modifiers
- cart
- checkout
- delivery/pickup
- customer login/guest checkout where configured
- coupons
- payment
- order confirmation

---

# SEO

Public pages:

- semantic HTML
- metadata
- canonical
- sitemap
- robots
- structured data
- Open Graph
- fast loading
- accessibility
- Core Web Vitals

Authenticated pages must not be indexed.

---

# KIOSK

Design for:

- touch
- large controls
- minimal typing
- accessibility
- fast ordering
- timeout
- session reset
- payment handoff

---

# SECURITY

Protect against:

- price manipulation
- coupon abuse
- unauthorized order modification
- replay
- duplicate payment
- session hijacking

---

# TESTING

Automated E2E:

Menu
→ Product
→ Modifier
→ Cart
→ Coupon
→ Checkout
→ Payment
→ Order

Manual testing:

- mobile
- tablet
- kiosk
- desktop
- slow network
- offline/reconnect
- accessibility