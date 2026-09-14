# RestaurantOS — Phase 1: Production Foundation Manual Verification Checklist

**Document ID:** `MANUAL-TEST-001`  
**Phase:** 1 — Production Foundation  
**Audience:** QA Engineers, Technical Product Managers, Developers  

---

## Pre-Requisites

1. Server running locally: `npm run dev` on `http://localhost:3000`.
2. Open either:
   - **PowerShell Terminal**, or
   - **Browser DevTools Console** (<kbd>F12</kbd> on `http://localhost:3000`).

---

## Test Scenarios

### 1. User & Tenant Registration (`POST /api/v1/auth/register`)

#### PowerShell Terminal Command

```powershell
$regBody = @{
    email = "owner@restotest.co.il"
    password = "SecurePassword123!"
    firstName = "Israel"
    lastName = "Israeli"
    organizationName = "Israeli Burgers"
} | ConvertTo-Json

$regRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" -Method Post -Body $regBody -ContentType "application/json"
$regRes | Format-List
```

#### Browser DevTools Console

```javascript
fetch("http://localhost:3000/api/v1/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "owner@restotest.co.il",
    password: "SecurePassword123!",
    firstName: "Israel",
    lastName: "Israeli",
    organizationName: "Israeli Burgers"
  })
})
.then(res => { console.log("Status:", res.status, res.statusText); return res.json(); })
.then(data => console.log("Response Body:", data));
```

- **Expected Result:**
  - Status: `201 Created`
  - Response body contains `user.id`, `user.email`, `organizationId`, and `branchId`.

---

### 2. Password Login & Session Cookie (`POST /api/v1/auth/login`)

#### PowerShell Terminal Command

```powershell
$loginBody = @{
    email = "owner@restotest.co.il"
    password = "SecurePassword123!"
} | ConvertTo-Json

$sessionRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -SessionVariable mySession
$sessionRes.session | Format-List
```

#### Browser DevTools Console

```javascript
fetch("http://localhost:3000/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "owner@restotest.co.il",
    password: "SecurePassword123!"
  })
})
.then(res => { console.log("Status:", res.status, res.statusText); return res.json(); })
.then(data => console.log("Response Body:", data));
```

- **Expected Result:**
  - Status: `200 OK`
  - Cookie `restaurant_os_session` set with `HttpOnly; SameSite=Strict`
  - `session.role`: `"OWNER"`
  - `session.permissions`: Array of 58 granular permissions.

#### Negative Test (Wrong Password)

```powershell
$badBody = @{ email = "owner@restotest.co.il"; password = "WrongPassword!" } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method Post -Body $badBody -ContentType "application/json"
} catch {
    Write-Host "HTTP Status:" $_.Exception.Response.StatusCode.value__ "(Expected: 401)"
}
```

---

### 3. Shared Terminal PIN Authentication & Brute-Force Lockout

#### Step 3A: Set Terminal PIN for User (`POST /api/v1/auth/set-pin`)

Set the user's terminal PIN to `4567`:

**PowerShell:**

```powershell
# Use the userId from Step 1 ($regRes.user.id)
$setPinBody = @{
    userId = $regRes.user.id
    pin = "4567"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/set-pin" -Method Post -Body $setPinBody -ContentType "application/json"
```

**Browser Console (replace `<USER_ID>`):**

```javascript
fetch("http://localhost:3000/api/v1/auth/set-pin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "PASTE_USER_ID_HERE",
    pin: "4567"
  })
})
.then(res => res.json())
.then(data => console.log("Set PIN Result:", data));
```

#### Step 3B: Valid Terminal PIN Login (`POST /api/v1/auth/pin-login`)

**PowerShell:**

```powershell
$pinBody = @{
    userId = $regRes.user.id
    pin = "4567"
    branchId = $regRes.branchId
} | ConvertTo-Json

$pinRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/pin-login" -Method Post -Body $pinBody -ContentType "application/json"
$pinRes.session | Format-List
```

**Browser Console (replace `<USER_ID>` and `<BRANCH_ID>`):**

```javascript
fetch("http://localhost:3000/api/v1/auth/pin-login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "PASTE_USER_ID_HERE",
    pin: "4567",
    branchId: "PASTE_BRANCH_ID_HERE"
  })
})
.then(res => { console.log("Status:", res.status, res.statusText); return res.json(); })
.then(data => console.log("PIN Login Success:", data));
```

- **Expected Result:** `200 OK`, valid session returned with `branchId` populated.

#### Step 3C: Brute-Force 5 Failed Attempts $\rightarrow$ 15-Minute Lockout

**PowerShell:**

```powershell
# Send 5 invalid attempts with wrong PIN "0000"
1..5 | ForEach-Object {
    $attempt = $_
    $wrongBody = @{ userId = $regRes.user.id; pin = "0000"; branchId = $regRes.branchId } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/pin-login" -Method Post -Body $wrongBody -ContentType "application/json"
    } catch {
        $msg = $_.ErrorDetails.Message
        Write-Host "Attempt ${attempt}: Status 401 -> $msg"
    }
}
```

- **Expected Result:**
  - Attempts 1–4: `401 Unauthorized` (`"Invalid PIN. X attempts remaining."`)
  - Attempt 5: `401 Unauthorized` (`"Terminal PIN locked due to excessive failed attempts. Try again in 15 minutes."`)

---

### 4. Authenticated Session Inspection (`GET /api/v1/auth/me`)

**PowerShell (using `$sessionRes.session.token`):**

```powershell
$headers = @{ Authorization = "Bearer " + $sessionRes.session.token }
$meRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" -Method Get -Headers $headers
$meRes | Format-List
```

**Browser Console (uses automatic browser cookie):**

```javascript
fetch("http://localhost:3000/api/v1/auth/me")
.then(res => { console.log("Status:", res.status); return res.json(); })
.then(data => console.log("Current Profile:", data));
```

- **Expected Result:** `200 OK` with user profile, organization ID, and permissions list.

---

### 5. Ephemeral WebSocket Ticket (`POST /api/v1/realtime/ticket`)

**PowerShell:**

```powershell
$headers = @{ Authorization = "Bearer " + $sessionRes.session.token }
$ticketRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/realtime/ticket" -Method Post -Headers $headers
$ticketRes | Format-List
```

**Browser Console:**

```javascript
fetch("http://localhost:3000/api/v1/realtime/ticket", { method: "POST" })
.then(res => { console.log("Status:", res.status); return res.json(); })
.then(data => console.log("WebSocket Ticket:", data));
```

- **Expected Result:** `200 OK` returning `{ ticket: "<UUID>", expiresInSeconds: 60 }`.

---

### 6. Public SEO & Crawling Rules (`GET /robots.txt` & `GET /sitemap.xml`)

**PowerShell:**

```powershell
# 1. robots.txt
(Invoke-WebRequest -Uri "http://localhost:3000/robots.txt" -UseBasicParsing).Content

# 2. sitemap.xml
(Invoke-WebRequest -Uri "http://localhost:3000/sitemap.xml" -UseBasicParsing).Content

# 3. Private route indexing header check
try { (Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/me" -UseBasicParsing).Headers["X-Robots-Tag"] } catch { $_.Exception.Response.Headers["X-Robots-Tag"] }
```

- **Expected Result:**
  - `robots.txt`: allows `/` and public paths; disallows `/api/`, `/backoffice/`, `/pos/`, `/kds/`.
  - `sitemap.xml`: returns valid XML.
  - Header: `X-Robots-Tag: noindex, nofollow`.

---

### 7. Stitch Design System Visual Verification

1. Navigate to: [http://localhost:3000](http://localhost:3000)
2. Verify:
   - Layout is strictly Right-to-Left (`dir="rtl"`).
   - Rubik font applied cleanly across all headings and tables.
   - All 7 Tri-Factor status badges visible:
     - `[ ⚡ חדשה ]` (Blue)
     - `[ ✓ אושרה ]` (Indigo)
     - `[ 🔥 בהכנה ]` (Amber Flame)
     - `[ 🔔 מוכנה ]` (Emerald)
     - `[ 🛵 במשלוח ]` (Sky Blue)
     - `[ 🟢 נמסרה ]` (Slate Gray)
     - `[ 🛑 בוטלה ]` (Crimson)

---

### 8. Password Reset Flow

#### Step 1 — Request a Password Reset Link

**PowerShell:**

```powershell
$body = @{ email = "owner@restotest.co.il" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/forgot-password" `
  -Method Post -Body $body -ContentType "application/json"
```

**Browser DevTools Console:**

```javascript
fetch("http://localhost:3000/api/v1/auth/forgot-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "owner@restotest.co.il" })
}).then(r => r.json()).then(console.log);
```

**Expected:** `200 OK` — `"If that email is registered, a password reset link has been sent."`
> Note: Also returns `200` for unregistered emails — prevents enumeration.

**Dev Token:** Check the **server terminal** for:

```
[Auth] Password reset link for owner@restotest.co.il: http://localhost:3000/auth/reset-password?token=<TOKEN>
```

Copy `<TOKEN>` for Step 2.

---

#### Step 2 — Reset Password Using the Token

**PowerShell:**

```powershell
$body = @{
  token = "<TOKEN_FROM_STEP_1>"
  newPassword = "NewSecurePassword1!"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/reset-password" `
  -Method Post -Body $body -ContentType "application/json"
```

**Browser DevTools Console:**

```javascript
fetch("http://localhost:3000/api/v1/auth/reset-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token: "<TOKEN_FROM_STEP_1>",
    newPassword: "NewSecurePassword1!"
  })
}).then(r => r.json()).then(console.log);
```

**Expected:** `200 OK` — `"Password has been reset successfully. Please log in again."`

**Verify session invalidation:** Use the old session cookie on any protected route → must return `401`.

**Verify one-time-use:** Re-submit the same token → must return `400` with `"invalid or has expired"`.

---

### 9. Email Verification Flow

#### Step 1 — Resend Verification Email (Authenticated)

**PowerShell (using `$sessionRes.session.token` or `$loginRes.session.token`):**

```powershell
$headers = @{ Authorization = "Bearer " + $sessionRes.session.token }
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/resend-verification" -Method Post -Headers $headers
```

**Browser DevTools Console (must log in first in the same tab):**

```javascript
// Step 1A: If not already logged in in this tab:
const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  // Note: Use "NewSecurePassword1!" if you ran Section 8 (Password Reset), or "SecurePassword123!" if not
  body: JSON.stringify({ email: "owner@restotest.co.il", password: "NewSecurePassword1!" })
}).then(r => r.json());

// Step 1B: Resend verification (supports both cookie and Authorization header)
fetch("http://localhost:3000/api/v1/auth/resend-verification", {
  method: "POST",
  credentials: "include",
  headers: { Authorization: "Bearer " + loginRes.session?.token }
}).then(r => r.json()).then(console.log);
```

**Expected:** `200 OK` — `"Verification email has been sent."`

**Dev Token:** Check the **server terminal** for:

```
[Auth] Email verification link for owner@restotest.co.il: http://localhost:3000/auth/verify-email?token=<TOKEN>
```

---

#### Step 2 — Verify Email Token

**PowerShell:**

```powershell
$body = @{ token = "<TOKEN_FROM_STEP_1>" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/verify-email" `
  -Method Post -Body $body -ContentType "application/json"
```

**Browser DevTools Console:**

```javascript
fetch("http://localhost:3000/api/v1/auth/verify-email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: "<TOKEN_FROM_STEP_1>" })
}).then(r => r.json()).then(console.log);
```

**Expected:** `200 OK` — `"Email verified successfully."`

**Verify one-time-use:** Re-submit same token → must return `400`.

**Verify no-op:** Call `resend-verification` after successful verify → server log must NOT emit a new token.

---

### 10. Security Infrastructure Verification

You can verify all security assertions in one command via Vitest, or run individual interactive checks below.

#### Quick Command: Run Full Security Test Suite (26 Checks)

```powershell
npx vitest run tests/security/security-suites.spec.ts
```

All 26 checks across Unauthorized Access, Cross-Tenant Isolation, Privilege Escalation, Token Tampering, File Upload, Rate Limiting, and Webhook Verification should pass with `✓`.

---

#### 10.1 & 10.2: Rate Limiting Verification

##### Test 10.1: Rate Limiter on Forgot-Password

Runs 6 rapid requests through Node/Vitest to confirm the 6th call returns `allowed: false`:

```powershell
npx vitest run tests/security/security-suites.spec.ts -t "blocks after exceeding max requests"
```

**Interactive Node One-Liner (PowerShell):**

```powershell
node -e '
  const { RateLimiter } = require("./src/core/security/rate-limiter");
  const rl = new RateLimiter();
  (async () => {
    for (let i = 1; i <= 6; i++) {
      const res = await rl.check("test-user-ip", { maxRequests: 5, windowSeconds: 60 });
      console.log(`Request ${i}: allowed = ${res.allowed}, remaining = ${res.remaining}`);
    }
  })();
'
```

- **Expected Output:**
  - Requests 1–5: `allowed = true`
  - Request 6: `allowed = false, remaining = 0`

---

#### 10.3 & 10.4: Webhook Signature & Replay Protection

##### Test 10.3: Reject Invalid Webhook Signature

```powershell
node -e '
  const { verifyWebhookSignature } = require("./src/core/security/webhook-verifier");
  const secret = "test_webhook_secret_key";
  const body = JSON.stringify({ event: "order.placed", orderId: "ord_100" });
  
  // Test with invalid signature
  const res = verifyWebhookSignature({
    body,
    signature: "sha256=invalid_signature_hex_0000000000000000000000000000000000000000000000000000000000000000",
    secret
  });
  console.log("Invalid Signature Check:", res);
'
```

- **Expected Output:** `{ valid: false, reason: "webhook: HMAC signature mismatch." }`

##### Test 10.4: Reject Stale Webhook (Replay Attack)

```powershell
node -e '
  const { verifyWebhookSignature } = require("./src/core/security/webhook-verifier");
  const crypto = require("crypto");
  const secret = "test_webhook_secret_key";
  const body = JSON.stringify({ event: "order.placed", orderId: "ord_100" });
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  
  // Timestamp from 10 minutes ago (stale > 300s window)
  const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
  
  const res = verifyWebhookSignature({
    body,
    signature: sig,
    secret,
    timestamp: staleTimestamp,
    toleranceSeconds: 300
  });
  console.log("Stale Replay Check:", res);
'
```

- **Expected Output:** `{ valid: false, reason: "webhook: Request timestamp is stale (age=600s, tolerance=300s). Possible replay attack." }`

---

#### 10.5 – 10.8: File Upload & MIME Magic-Byte Security

##### Test 10.5: Reject MIME Spoofing (HTML/PHP in .jpg)

```powershell
node -e '
  const { validateFileUpload } = require("./src/core/security/file-validator");
  const fakeJpg = Buffer.from("<html><script>alert(1)</script></html>");
  const res = validateFileUpload({ buffer: fakeJpg, filename: "avatar.jpg" });
  console.log("MIME Spoofing Result:", res);
'
```

- **Expected Output:** `{ valid: false, reason: "Unable to identify file type from content. Upload rejected." }`

##### Test 10.6: Reject Oversized Upload (> 10 MB)

```powershell
node -e '
  const { validateFileUpload } = require("./src/core/security/file-validator");
  const hugeBuf = Buffer.alloc(11 * 1024 * 1024); // 11 MB
  const res = validateFileUpload({ buffer: hugeBuf, filename: "menu.pdf" });
  console.log("Oversized Upload Result:", res);
'
```

- **Expected Output:** `{ valid: false, reason: "File exceeds the maximum allowed size of 10 MB." }`

##### Test 10.7: Path Traversal Neutralization

```powershell
node -e '
  const { validateFileUpload } = require("./src/core/security/file-validator");
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(50).fill(0)]);
  const res = validateFileUpload({ buffer: pngMagic, filename: "../../etc/passwd.png" });
  console.log("Path Traversal Result:", res);
'
```

- **Expected Output:** `{ valid: true, detectedMimeType: "image/png", sanitizedFilename: "passwd.png" }`
*(Note: Directory path `../../etc/` is stripped safely).*

##### Test 10.8: Accept Valid PNG File

```powershell
node -e '
  const { validateFileUpload } = require("./src/core/security/file-validator");
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0)]);
  const res = validateFileUpload({ buffer: pngMagic, filename: "restaurant-logo.png" });
  console.log("Valid PNG Upload Result:", res);
'
```

- **Expected Output:** `{ valid: true, detectedMimeType: "image/png", sanitizedFilename: "restaurant-logo.png" }`

