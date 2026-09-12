# RestaurantOS — Master Product Requirements Document (PRD)

**Document ID:** `DOC-PRD-001`  
**Version:** `1.1.0`  
**Status:** Approved Canonical PRD  
**Audience:** Product Engineering, UX/UI Designers, QA Engineers, Enterprise Stakeholders  

---

## 1. Product Vision & Target Personas

RestaurantOS is an all-in-one Operating System designed to streamline high-velocity restaurant operations across single-unit restaurants, dark kitchens, fast-casual chains, fine dining, pizzerias, burger joints, sushi bars, and multi-brand ghost kitchen hubs.

### Core User Personas:
1. **Chain Owner / Enterprise HQ Executive:** Needs multi-brand reporting, unified menu management, consolidated P&L, and global role delegation.
2. **Restaurant General Manager:** Needs real-time shift oversight, delivery dispatch approvals, inventory reordering, and end-of-day cash/sales reconciliation.
3. **Head Chef / Kitchen Manager:** Needs high-visibility KDS station rails, preparation pacing timers, 86ing (item availability toggles), and recipe compliance.
4. **Line Cook / Prep Employee:** Needs simple, high-contrast, touch/bump-bar friendly ticket controls with immediate visual feedback.
5. **Cashier / Front-of-House Staff:** Needs ultra-fast POS ordering, split bills, table transfers, and cash drawer management.
6. **Phone Order Intake Operator:** Needs instant caller ID popup, previous order lookup, and fast search-to-basket checkout.
7. **Delivery Driver:** Needs clean mobile UI for shift clock-in, FIFO queue tracking, one-tap self-assignment, GPS turn-by-turn launch, and proof of delivery.
8. **Fleet & Logistics Supervisor:** Needs real-time fleet map, vehicle telematics, tracker health alerts, and driver-vehicle assignment tools.
9. **End Customer:** Needs blazing-fast mobile web ordering, intuitive modifier customization, real-time live order status tracking, and loyalty rewards.

---

## 2. Comprehensive Requirements Across Core Modules

### 2.1 Identity, Access & Multi-Tenancy (Modules 1–8)
- **Module 1: Authentication:** Secure cookie session auth, OAuth2/OIDC, passwordless magic links for drivers, PIN-code fast switching for POS/KDS shared hardware.
- **Module 2: Users:** Global user accounts capable of holding different roles across multiple organizations without account duplication.
- **Module 3: Organizations:** Top-level multi-tenant account root. Enforces enterprise subscription tier, organization-level audit logs, and global settings.
- **Module 4: Restaurants:** Brand entities under an organization. Supports distinct logos, branding, menu structures, and tax defaults.
- **Module 5: Branches:** Physical or virtual operating locations. Defines geocoded coordinates, delivery polygons, working hours, and printer hardware mappings.
- **Module 6: Roles:** 12 core system roles (SuperAdmin, Owner, Admin, GeneralManager, ShiftManager, KitchenManager, LineCook, Cashier, DispatchManager, Driver, InventoryManager, Accountant, Viewer) + custom role builder.
- **Module 7: Permissions:** Granular RBAC permissions evaluated on every API action (`orders:create`, `orders:cancel`, `deliveries:batch`, `menu:update_price`, etc.).
- **Module 8: Employees:** Association of users with specific branches, hourly rate tracking, clock-in/out shift logging, and fast 4-digit PIN authentication.

### 2.2 Customer & CRM (Modules 9–10, 31–34)
- **Module 9: Customer CRM:** Central customer profile aggregating total orders, lifetime value (LTV), average order value (AOV), favorite items, dietary restrictions, and allergy flags.
- **Module 10: Addresses & Geointelligence:** Multi-address customer profile with street, house number, entrance, floor, apartment, gate access code, and parking instructions.
- **Module 31: Campaigns:** Multi-channel targeted marketing campaigns (SMS, WhatsApp, Email) based on customer segmentation.
- **Module 32: Promotions:** Complex pricing promotion rules (BOGO, percentage discount, fixed combo meals, happy hour schedule overrides).
- **Module 33: Coupons:** Alphanumeric discount codes supporting usage caps, minimum spend rules, expiration dates, and branch restrictions.
- **Module 34: Loyalty Programs:** Tiered point accumulation, point redemption catalog, and birthday rewards.

### 2.3 Catalog & Menu Engineering (Modules 11–14)
- **Module 11: Menus:** Multi-menu management (Dine-in, Takeaway, Delivery, Late Night, Bar) with time-based daypart availability.
- **Module 12: Products:** Items with multilingual titles, rich descriptions, tax categories, calories, allergens, and kitchen preparation stations.
- **Module 13: Categories:** Hierarchical category trees with drag-and-drop sorting and visual banner imagery.
- **Module 14: Modifiers & Option Groups:** Nested modifier groups (Required Single Choice, Optional Multiple Choice, Min/Max restrictions).

### 2.4 Universal Orders & Transactions (Modules 15–16)
- **Module 15: Universal Order Engine:** Master order intake pipeline handling Web, POS, Kiosk, Phone, Wolt, 10bis, and Mishloha into a single finite state machine:
  $$\text{DRAFT} \rightarrow \text{CONFIRMED} \rightarrow \text{ACCEPTED} \rightarrow \text{IN\_PREPARATION} \rightarrow \text{READY} \rightarrow \text{COMPLETED}$$
  *(Cancellation paths: `CANCELLED`, `FAILED`).*
- **Module 16: Payments & Clearing:** Multi-currency payment processing supporting EMV credit card terminals, cash, gift cards, digital wallets (Apple Pay, Google Pay), and provider split payments.

### 2.5 Logistics, Delivery & Driver Queue (Modules 17–19)
- **Module 17: Delivery Management:** Independent delivery state machine:
  $$\text{WAITING} \rightarrow \text{PREPARING} \rightarrow \text{READY} \rightarrow \text{AVAILABLE\_FOR\_ASSIGNMENT} \rightarrow \text{ASSIGNED} \rightarrow \text{PICKED\_UP} \rightarrow \text{OUT\_FOR\_DELIVERY} \rightarrow \text{ARRIVED\_AT\_CUSTOMER\_AREA} \rightarrow \text{DELIVERED}$$
  *(Supports driver release back to `AVAILABLE_FOR_ASSIGNMENT`).*
- **Module 18: Drivers & Availability Queue:**
  - Multidimensional driver status: Shift (`OFF_SHIFT`, `ON_SHIFT`, `BREAK`), Assignment (`AVAILABLE`, `ASSIGNED`), Trip (`NOT_STARTED`, `IN_TRANSIT`, `AT_CUSTOMER`, `RETURNING`).
  - Deterministic FIFO availability queue ordered by `available_since ASC`.
  - Distinct events for `DriverReturnedFromBreak` and `DriverReturnedToRestaurant`.
  - Driver data security via `DeliveryViewDTO` (least privilege data minimization: street, entrance, floor, notes, masked contact; zero access to full CRM).
- **Module 19: Delivery Smart Batching:** Multi-factor heuristic scoring engine clustering compatible deliveries (distance, azimuth alignment, prep sync, SLA headroom, vehicle capacity) with mandatory Manager Approval workflow (`APPROVE`, `REJECT`, `MODIFY`, `FORCE`). Decision telemetry recorded in `intelligence_decision_logs`.

### 2.6 Vehicles, Trackers & Fleet Telematics (Fleet Domain)
- **Vehicles:** First-class physical asset tracking (type, license plate, make, model, capacity, active status).
- **Trackers:** First-class telematics hardware entity (IMEI, vendor, battery, firmware).
- **Temporal Assignments:** Explicit tracking via `DriverVehicleAssignment` and `VehicleTrackerAssignment`.
- **Telematics Standards:** Primary active operational tracking via continuous GPS + cellular/LTE telematics. Secondary / anti-theft backup tracking via Bluetooth crowd tags (AirTags).
- **Telemetry $\neq$ Business Truth:** GPS geofence entry triggers `VehicleEnteredCustomerGeofence` and updates delivery to `ARRIVED_AT_CUSTOMER_AREA`, but NEVER auto-completes delivery without driver/human confirmation.

### 2.7 Kitchen Operations & KDS (Module 20)
- **Module 20: Kitchen Display System:**
  - Independent cooking lifecycle: $\text{QUEUED} \rightarrow \text{STARTED} \rightarrow \text{READY} \rightarrow \text{BUMPED} \quad (\text{RECALLED})$.
  - High-visibility KDS SLA Visual Model:
    - `NORMAL`: Green/neutral timer.
    - `NEAR_SLA`: Amber warning badge.
    - `SLA_EXCEEDED`: High-contrast full red ticket header, bold white text, large elapsed timer (e.g. `+00:37`), warning icon, subtle pulse, designed for instant legibility from 1.5–2 meters.
  - Multi-station splitting (Grill / Salad / Fryer / Expo) and thermal paper fallback spooling.

### 2.8 Telephony & Omnichannel Ordering (Modules 21–23)
- **Module 21: Telephony Integration:** SIP/WebRTC PBX integration triggering automatic Caller ID popups, instant customer profile recognition, and fast one-click order initiation.
- **Module 22: Website Ordering:** Public SEO-optimized mobile-first web storefront with rich schema markup, ultra-fast menu navigation, and real-time basket calculation.
- **Module 23: Self-Service Kiosk:** Full-screen locked kiosk mode designed for rapid customer self-checkout with upsell recommendation prompts and EMV terminal handshakes.

### 2.9 Supply Chain, Inventory & Recipes (Modules 24–30)
- **Module 24: Real-time Inventory:** Multi-unit stock tracking with configurable depletion policy: `ON_ACCEPTED` (default), `ON_PREPARATION_START`, or `ON_FULFILLMENT`.
- **Module 25: Warehousing & Transfers:** Central commissary / warehouse tracking and inter-branch inventory transfer requisition orders.
- **Module 26: Suppliers:** Vendor catalog directories, lead times, ordering minimums, and direct purchase order transmissions.
- **Module 27: Purchasing:** Purchase orders (PO) workflow with 3-way matching.
- **Module 28: Recipes & Bill of Materials (BOM):** Granular ingredient mapping per product and modifier, calculating real-time plate cost and theoretical food cost.
- **Module 29: Stock Movements:** Automatic inventory depletions triggered per configured depletion policy and manual physical audit reconciliations.
- **Module 30: Waste Tracking:** Waste logging with standardized reason codes (Expired, Dropped, Burnt, Customer Return, Quality Defect).

### 2.10 Analytics, Auditing & Governance (Modules 35–43)
- **Module 35: Analytics Dashboards:** Real-time sales velocity, peak-hour kitchen throughput, driver transit times, and channel breakdown.
- **Module 36: Reporting & EOD:** End-of-Day (EOD) Z-reports, tax summaries, cash drawer variance reports, and accounting export files.
- **Module 37: Notifications:** Templated multi-channel notifications engine (In-app WebSocket, Email, SMS, WhatsApp, Web Push).
- **Module 38: Integration Hub:** Pluggable adapter layer split into Core Business Integrations (Wolt, 10bis, Mishloha, Green Invoice, Meshulam) and Platform/Infrastructure Integrations (Stripe, Twilio, Telephony SIP, Telematics Trackers).
- **Module 39: Audit Logging:** Immutable security and operational audit trail recording every state change with actor, IP, timestamp, and before/after diff.
- **Module 40: System Settings:** Platform-wide feature defaults, internationalization (i18n), currencies, and multi-region deployment configurations.
- **Module 41: Restaurant & Branch Settings:** Branch operational hours, prep lead times, delivery radii, service charges, and receipt printer layouts.
- **Module 42: Feature Flags:** Fine-grained feature rollout controls toggled per organization, brand, branch, or employee role.
- **Module 43: SaaS Subscriptions & Billing:** Tenant subscription tiers, metered transaction fees, automated invoice generation, and dunning workflows.

### 2.11 Future Intelligence Scaffolding (Module 44)
- **Module 44: Intelligence Extension Layer:** Abstract interfaces for Gen 2–5 AI engines (`IPredictionEngine`, `IRecommendationEngine`, `IDecisionEngine`, `ILearningEngine`, `IAutomationPolicyEngine`). In Gen 1, all human operational decisions are recorded in `intelligence_decision_logs` with `model_version = NULL`.
