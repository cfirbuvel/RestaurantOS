# RestaurantOS — Phase 1: Production Foundation Manual Verification Checklist

**Document ID:** `MANUAL-TEST-001`  
**Phase:** 1 — Production Foundation  
**Audience:** QA Engineers, Technical Product Managers, Developers  

---

## Pre-Requisites
1. Server running locally: `npm run dev` on `http://localhost:3000`.
2. Clean database or development reset state.
3. HTTP client (cURL, Postman, or Browser DevTools).

---

## Test Scenarios

### 1. User & Tenant Registration
- **Step 1:** Send `POST /api/v1/auth/register` with body:
  ```json
  {
    "email": "owner@restotest.co.il",
    "password": "SecurePassword123!",
    "firstName": "Israel",
    "lastName": "Israeli",
    "organizationName": "Israeli Burgers"
  }
  ```
- **Expected Result:**
  - Status Code `201 Created`
  - Response body contains user details (`id`, `email`, `firstName`, `lastName`) and `organizationId`.
  - Database contains user with `password_hash` (hashed with bcrypt, not plaintext) and role `OWNER` in `user_organizations`.
  - `audit_logs` table records `USER_REGISTERED` event.

---

### 2. Password Login & Session Cookie Verification
- **Step 1:** Send `POST /api/v1/auth/login` with credentials:
  ```json
  {
    "email": "owner@restotest.co.il",
    "password": "SecurePassword123!"
  }
  ```
- **Expected Result:**
  - Status Code `200 OK`.
  - Response header contains `Set-Cookie: restaurant_os_session=...; Path=/; HttpOnly; SameSite=Strict`.
  - Response payload includes `session.role = "OWNER"` and array of 50+ granular permissions.
- **Step 2 (Negative Test):** Send `POST /api/v1/auth/login` with incorrect password.
  - Status Code `401 Unauthorized` (`"Invalid email or password"`).
  - Rate limiting counter increments.

---

### 3. Shared Terminal PIN Authentication & Brute-Force Lockout
- **Step 1:** Set user terminal PIN (e.g., via API or test script `authService.setUserPin(userId, "4567")`).
- **Step 2:** Send `POST /api/v1/auth/pin-login` with valid PIN:
  ```json
  {
    "userId": "<user_uuid>",
    "pin": "4567",
    "branchId": "<branch_uuid>"
  }
  ```
  - **Expected Result:** `200 OK`, valid session returned with `branchId` populated.
- **Step 3:** Perform 5 consecutive failed PIN requests with `"pin": "0000"`.
  - Attempts 1–4: `401 Unauthorized` with remaining attempts counter (e.g. `"4 attempts remaining"`).
  - Attempt 5: `401 Unauthorized` with message `"Terminal PIN locked due to excessive failed attempts. Try again in 15 minutes."`.
- **Step 4:** Immediately send attempt 6 with correct PIN `"4567"`.
  - **Expected Result:** Still returns `401 Unauthorized` indicating terminal lockout is active.

---

### 4. Authenticated Session & RBAC Enforcement (`GET /api/v1/auth/me`)
- **Step 1:** Send `GET /api/v1/auth/me` with `Cookie: restaurant_os_session=<valid_token>`.
  - **Expected Result:** `200 OK` with user profile, organization ID, and role.
- **Step 2:** Send `GET /api/v1/auth/me` without cookie or token.
  - **Expected Result:** `401 Unauthorized`.

---

### 5. Ephemeral WebSocket Ticket Generation
- **Step 1:** Send authenticated `POST /api/v1/realtime/ticket`.
  - **Expected Result:** `200 OK` returning `{ "ticket": "<uuid>", "expiresInSeconds": 60 }`.
  - Key exists in Redis under `ticket:<uuid>` with TTL $\le$ 60 seconds.

---

### 6. Public SEO & Indexing Prevention
- **Step 1:** Request `GET /robots.txt`.
  - **Expected Result:**
    - `Allow: /`, `/menu/*`, `/order/*`, `/restaurant/*`
    - `Disallow: /api/`, `/backoffice/`, `/pos/`, `/kds/`, `/admin/`
- **Step 2:** Inspect HTTP response headers on any `/api/v1/*` route.
  - **Expected Result:** Header `X-Robots-Tag: noindex, nofollow` is present.
- **Step 3:** Request `GET /sitemap.xml`.
  - **Expected Result:** Returns valid XML sitemap with public storefront entrypoints.

---

### 7. Stitch Design System Visual Verification
- **Step 1:** Navigate to `http://localhost:3000/`.
- **Expected Result:**
  - Page direction is strictly RTL (`dir="rtl"`).
  - Typography renders with Rubik.
  - Deep slate header (`#0F172A`), operational cards, and metric indicators visible.
  - 7 Tri-Factor status badges visible with 10% tinted background, 100% border, Lucide icon, and unambiguous Hebrew label (`חדשה`, `אושרה`, `בהכנה`, `מוכנה`, `במשלוח`, `נמסרה`, `בוטלה`).
  - No horizontal layout overflows or misaligned currency symbols (`₪`).
