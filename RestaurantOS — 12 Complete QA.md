# RestaurantOS — Complete QA and Verification

Act as an independent QA organization.

Do not assume previous agents implemented features correctly.

---

# TEST LEVELS

Run:

Unit
Integration
API
Database
Contract
E2E
Regression
Security
Performance
Accessibility
Mobile
Responsive
Browser compatibility

---

# BUSINESS FLOWS

Test complete flows:

Customer
→ Order
→ Kitchen
→ Ready
→ Delivery
→ Driver
→ Delivered
→ CRM
→ Analytics

Inventory:

Purchase
→ Receive
→ Warehouse
→ Recipe
→ Sale
→ Deduction
→ Reporting

Marketing:

Customer
→ Campaign
→ Coupon
→ Order
→ Redemption
→ Analytics

---

# FAILURE TESTING

Simulate:

- database failure
- network failure
- provider failure
- webhook duplication
- timeout
- browser refresh
- concurrent employees
- duplicate clicks
- stale sessions
- partial transaction failure

---

# LOAD

Test realistic restaurant load.

Include:

100 concurrent users
500 concurrent users
1000 concurrent API operations where appropriate

Measure:

latency
error rate
CPU
memory
database performance
queue latency

---

# ACCESSIBILITY

Test WCAG-oriented accessibility.

---

# MANUAL TESTING

Every module must have a manual checklist.

A manual test is only PASS if:

Expected result matches actual result.

Record:

Environment
Browser
Device
Test data
Steps
Expected
Actual
Result
Screenshot/evidence where useful

---

# FINAL QA REPORT

Create:

/docs/testing/FINAL_QA_REPORT.md

Classify:

Critical
High
Medium
Low

Do not declare production ready while critical issues remain.