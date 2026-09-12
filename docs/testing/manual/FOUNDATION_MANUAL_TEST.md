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

#### PowerShell Terminal Command:
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

#### Browser DevTools Console:
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

#### PowerShell Terminal Command:
```powershell
$loginBody = @{
    email = "owner@restotest.co.il"
    password = "SecurePassword123!"
} | ConvertTo-Json

$sessionRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -SessionVariable mySession
$sessionRes.session | Format-List
```

#### Browser DevTools Console:
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

#### Negative Test (Wrong Password):
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
.then(res => res.json())
.then(data => console.log("WebSocket Ticket:", data));
```
- **Expected Result:** `200 OK` returning `{ ticket: "<UUID>", expiresInSeconds: 60 }`.

---

### 6. Public SEO & Crawling Rules (`GET /robots.txt` & `GET /sitemap.xml`)

**PowerShell:**
```powershell
# 1. robots.txt
(Invoke-WebRequest -Uri "http://localhost:3000/robots.txt").Content

# 2. sitemap.xml
(Invoke-WebRequest -Uri "http://localhost:3000/sitemap.xml").Content

# 3. Private route indexing header check
(Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/me").Headers["X-Robots-Tag"]
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
