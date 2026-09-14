# RestaurantOS — Phase 3 Manual Verification Guide
## Kitchen Display System (KDS), Ephemeral Real-Time Auth & SLA Engine

**Document ID:** `MANUAL-TEST-003`  
**Phase:** `PHASE 3 — Kitchen Display System (KDS)`  
**Base URL:** `http://localhost:3000/api/v1`

---

## Pre-Requisites

1. Next.js dev server running on `http://localhost:3000`.
2. Seed data loaded (Israeli Burgers - Main branch).
3. PowerShell 5.1+ configured for UTF-8.

---

### Step 0: Obtain Authentication Token & Set UTF-8

> [!NOTE]
> Setting UTF-8 encoding ensures clean handling of Hebrew station names and output formatting.

**PowerShell:**
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$loginBody = @{
    email = "owner@restotest.co.il"
    password = "SecurePassword123!" # or "NewSecurePassword1!"
} | ConvertTo-Json -Compress

$loginRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
    -Method Post `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($loginBody)) `
    -ContentType "application/json; charset=utf-8"

$headers = @{ Authorization = "Bearer " + $loginRes.session.token }
Write-Host "Logged in as:" $loginRes.user.email "Role:" $loginRes.session.role
```

- **Expected Result:** `200 OK` returning valid Bearer token for OWNER role.

---

### Step 1: Query Configured KDS Stations

**PowerShell:**
```powershell
$stationsRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/stations" `
    -Method Get `
    -Headers $headers

$stationsRes.stations | Format-Table id, name, display_name, station_type, is_active
```

- **Expected Result:** `200 OK` with 3 default seeded stations:
  1. `burgers` (`st-01-burgers`) — `KITCHEN`
  2. `sides` (`st-02-sides`) — `KITCHEN`
  3. `drinks` (`st-03-drinks`) — `EXPO`

---

### Step 2: Create a Custom Station (e.g. Salads / Preparations)

**PowerShell:**
```powershell
$newStationBody = @{
    name = "salads"
    displayName = "עמדת סלטים (Salads)"
    stationType = "KITCHEN"
    isActive = $true
} | ConvertTo-Json -Compress

$createdStation = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/stations" `
    -Method Post `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($newStationBody)) `
    -ContentType "application/json; charset=utf-8" `
    -Headers $headers

$createdStation.station | Format-List
```

- **Expected Result:** `201 Created` returning new station entity with generated UUID.

---

### Step 3: Issue Ephemeral WebSocket / SSE Connection Ticket

> [!IMPORTANT]
> Long-lived session tokens are **never** placed in WebSocket or SSE URLs. The KDS client requests an ephemeral 60s single-use ticket.

**PowerShell:**
```powershell
$ticketBody = @{
    stationId = "st-01-burgers"
} | ConvertTo-Json -Compress

$ticketRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/realtime/ticket" `
    -Method Post `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($ticketBody)) `
    -ContentType "application/json; charset=utf-8" `
    -Headers $headers

Write-Host "Ephemeral Ticket Issued:" $ticketRes.ticket
Write-Host "Target Channel:" $ticketRes.channel
Write-Host "Expires At:" $ticketRes.expiresAt
```

- **Expected Result:** `201 Created` with a ticket string starting with `tk_`, 60-second expiration, and channel `branch:<id>:kds:st-01-burgers`.

---

### Step 4: Verify Single-Use Token Enforcement on Real-Time Stream

**PowerShell:**
```powershell
# 4.1 First consumption: connects and receives handshake event
$streamUrl = "http://localhost:3000/api/v1/kds/stream?ticket=" + $ticketRes.ticket

$req = [System.Net.HttpWebRequest]::Create($streamUrl)
$req.Method = "GET"
$req.Timeout = 5000 # 5 seconds sample
try {
    $resp = $req.GetResponse()
    $stream = $resp.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $line1 = $reader.ReadLine()
    $line2 = $reader.ReadLine()
    Write-Host "SSE Handshake:" $line1 $line2
    $resp.Close()
} catch {
    Write-Host "Stream sample received or timed out as expected."
}

# 4.2 Second consumption of same ticket must return 401 Unauthorized
try {
    $secondTry = Invoke-RestMethod -Uri $streamUrl -Method Get
    Write-Error "Ticket should have been rejected as already consumed!"
} catch {
    Write-Host "Single-use ticket properly rejected on replay (401 Unauthorized):" $_.Exception.Message
}
```

- **Expected Result:** First connection receives `event: connected` handshake; second attempt returns `401 Unauthorized` with `Ticket has already been consumed (single-use)`.

---

### Step 5: Query Live KDS Tickets & Verify SLA Metrics & Zero Customer PII

**PowerShell:**
```powershell
$ticketsRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/tickets?stationId=st-01-burgers" `
    -Method Get `
    -Headers $headers

$ticketsRes.tickets | Format-Table id, order_number, status, priority, sla_status, formatted_timer
```

- **Expected Result:**
  - Returns seeded burger ticket `kds-tkt-01-burgers` in `QUEUED` status.
  - Computed SLA fields present: `sla_status` (`NORMAL` / `NEAR_SLA` / `SLA_EXCEEDED`), `formatted_timer`.
  - **Zero Customer PII:** No customer name, phone number, address, or payment data in response.

---

### Step 6: KDS Ticket Preparation Lifecycle & Cross-Station Coordination

#### 6.1 Start Preparation (`QUEUED -> STARTED`)

**PowerShell:**
```powershell
$started = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/tickets/kds-tkt-01-burgers/start" `
    -Method Post `
    -Headers $headers

Write-Host "Ticket status is now:" $started.ticket.status "(Started at: $($started.ticket.started_at))"
```

- **Expected Result:** `200 OK` with status `STARTED`.

#### 6.2 Mark Ready (`STARTED -> READY`)

**PowerShell:**
```powershell
$ready = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/tickets/kds-tkt-01-burgers/ready" `
    -Method Post `
    -Headers $headers

Write-Host "Ticket status:" $ready.ticket.status
Write-Host "All stations ready for order:" $ready.allStationsReady
```

- **Expected Result:** `200 OK` with status `READY`, `allStationsReady: False` (sides and drinks stations are still pending).

#### 6.3 Cross-Station Coordination (All Stations Ready -> Order Ready)

**PowerShell:**
```powershell
# Start and ready sides station
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/tickets/kds-tkt-02-sides/start" -Method Post -Headers $headers | Out-Null
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/tickets/kds-tkt-02-sides/ready" -Method Post -Headers $headers | Out-Null

# Start and ready drinks station (last station)
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/tickets/kds-tkt-03-drinks/start" -Method Post -Headers $headers | Out-Null
$finalReady = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/tickets/kds-tkt-03-drinks/ready" -Method Post -Headers $headers

Write-Host "Final station ready:" $finalReady.ticket.status
Write-Host "All stations ready:" $finalReady.allStationsReady

# Verify downstream Order status transitioned to READY
$orderRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/ord-01-seed-sample" -Method Get -Headers $headers
Write-Host "Downstream Order Status:" $orderRes.order.status
```

- **Expected Result:** `allStationsReady: True` on the last station, and downstream order status is updated to `READY`.

#### 6.4 Expo Bumps Ticket Off Rail (`READY -> COMPLETED`)

**PowerShell:**
```powershell
$bumped = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/tickets/kds-tkt-01-burgers/bump" `
    -Method Post `
    -Headers $headers

Write-Host "Ticket bumped to:" $bumped.ticket.status "(Completed at: $($bumped.ticket.completed_at))"
```

- **Expected Result:** `200 OK` with status `COMPLETED`.

#### 6.5 Expo Recalls Bumped Ticket (`COMPLETED -> RECALLED`)

**PowerShell:**
```powershell
$recalled = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/kds/tickets/kds-tkt-01-burgers/recall" `
    -Method Post `
    -Headers $headers

Write-Host "Ticket recalled to:" $recalled.ticket.status "(Recalled at: $($recalled.ticket.recalled_at))"
```

- **Expected Result:** `200 OK` with status `RECALLED`.
