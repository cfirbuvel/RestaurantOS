# RestaurantOS — Phase 7: Restaurant Telephony

Implement telephony integration through an abstraction layer.

---

# REQUIREMENTS

Support future providers through adapters.

When a customer calls:

1. Detect caller number.
2. Find customer.
3. Open customer profile.
4. Show previous orders.
5. Show preferred address.
6. Show relevant notes.
7. Allow employee to create order.

---

# FUTURE

Prepare architecture for:

- call recording
- transcription
- AI call summaries
- AI order assistance
- "same as last order"
- automatic order extraction

Do not make AI responsible for final order submission in Gen 1.

---

# PRIVACY

Implement:

- consent handling where required
- retention policies
- access control
- audit logs
- secure storage
- deletion mechanisms

---

# TESTING

Automated:

- caller matching
- unknown caller
- multiple customers
- phone normalization
- authorization
- tenant isolation

Manual:

/docs/testing/manual/TELEPHONY_MANUAL_TEST.md