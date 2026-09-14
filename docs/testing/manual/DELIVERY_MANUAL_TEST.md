# RestaurantOS: Phase 4 Delivery & Logistics Manual Test Runbook

This runbook provides end-to-end PowerShell commands for verifying Phase 4 features: Driver Shift Management, FIFO Availability Queue, Atomic Self-Assignment, Delivery Lifecycle Transitions, Fleet Telematics & Geofencing, and Advisory Smart Batching.

---

## 1. Environment & Auth Setup

```powershell
$baseUrl = "http://localhost:3000/api/v1"

# 1. Manager Login
$mgrLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{
    email = "manager@israeliburgers.co.il"
    password = "Password123!"
} | ConvertTo-Json)
$mgrToken = $mgrLogin.token
$orgId = $mgrLogin.user.organizationId
$branchId = $mgrLogin.user.branchId

$mgrHeaders = @{
    "Authorization" = "Bearer $mgrToken"
    "x-organization-id" = $orgId
    "x-branch-id" = $branchId
}

# 2. Driver 1 Login
$d1Login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{
    email = "driver1@israeliburgers.co.il"
    password = "Password123!"
} | ConvertTo-Json)
$d1Token = $d1Login.token
$d1Headers = @{
    "Authorization" = "Bearer $d1Token"
    "x-organization-id" = $orgId
    "x-branch-id" = $branchId
}

# 3. Driver 2 Login
$d2Login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{
    email = "driver2@israeliburgers.co.il"
    password = "Password123!"
} | ConvertTo-Json)
$d2Token = $d2Login.token
$d2Headers = @{
    "Authorization" = "Bearer $d2Token"
    "x-organization-id" = $orgId
    "x-branch-id" = $branchId
}
```

---

## 2. Driver Shift Lifecycle & FIFO Queue Verification

```powershell
# Driver 1 clocks in
Invoke-RestMethod -Uri "$baseUrl/drivers/me/clock-in" -Method POST -Headers $d1Headers

Start-Sleep -Seconds 1

# Driver 2 clocks in
Invoke-RestMethod -Uri "$baseUrl/drivers/me/clock-in" -Method POST -Headers $d2Headers

# Check FIFO queue (Driver 1 must be position 1, Driver 2 position 2)
$queue = Invoke-RestMethod -Uri "$baseUrl/deliveries/queue" -Method GET -Headers $mgrHeaders
$queue.queue | Format-Table userId, shiftStatus, assignmentStatus, queuePosition

# Driver 1 starts a break
Invoke-RestMethod -Uri "$baseUrl/drivers/me/break" -Method POST -Headers $d1Headers

# Check FIFO queue (Driver 2 should now be position 1)
$queueAfterBreak = Invoke-RestMethod -Uri "$baseUrl/deliveries/queue" -Method GET -Headers $mgrHeaders
$queueAfterBreak.queue | Format-Table userId, shiftStatus, assignmentStatus, queuePosition

# Driver 1 returns from break (rejoins back of queue -> position 2)
Invoke-RestMethod -Uri "$baseUrl/drivers/me/return-from-break" -Method POST -Headers $d1Headers
$queueAfterReturn = Invoke-RestMethod -Uri "$baseUrl/deliveries/queue" -Method GET -Headers $mgrHeaders
$queueAfterReturn.queue | Format-Table userId, shiftStatus, assignmentStatus, queuePosition
```

---

## 3. Delivery Creation & Atomic Concurrency / Self-Assignment Test

```powershell
# Create a Delivery
$newDelivery = Invoke-RestMethod -Uri "$baseUrl/deliveries" -Method POST -Headers $mgrHeaders -Body (@{
    orderId = "ord-manual-101"
    priority = "NORMAL"
    deliveryAddress = @{
        street = "Rothschild"
        houseNumber = "25"
        floor = "2"
        apartment = "4"
        city = "Tel Aviv"
        gateCode = "1234"
        deliveryNotes = "Ring bell"
        latitude = 32.0625
        longitude = 34.7702
    }
} | ConvertTo-Json)
$delId = $newDelivery.delivery.id

# Driver 2 claims delivery
$claimed = Invoke-RestMethod -Uri "$baseUrl/deliveries/$delId/self-assign" -Method POST -Headers $d2Headers
Write-Host "Driver 2 successfully claimed delivery: $($claimed.delivery.status)"

# Driver 1 attempts to claim the same delivery (Expect 409 Conflict)
try {
    Invoke-RestMethod -Uri "$baseUrl/deliveries/$delId/self-assign" -Method POST -Headers $d1Headers
} catch {
    Write-Host "Expected 409 Conflict occurred: $($_.Exception.Message)"
}
```

---

## 4. Delivery Lifecycle & Geofence Telemetry

```powershell
# Driver 2 picks up
Invoke-RestMethod -Uri "$baseUrl/deliveries/$delId/pickup" -Method POST -Headers $d2Headers

# Driver 2 starts transit (OUT_FOR_DELIVERY)
Invoke-RestMethod -Uri "$baseUrl/deliveries/$delId/start" -Method POST -Headers $d2Headers

# Simulate IoT Tracker Telemetry packet near destination (within 150m)
$telemetry = Invoke-RestMethod -Uri "$baseUrl/telemetry/location" -Method POST -Headers $mgrHeaders -Body (@{
    trackerId = "trk-demo-01"
    latitude = 32.0626
    longitude = 34.7703
    speedKmh = 10
} | ConvertTo-Json)
Write-Host "Geofence Triggered: $($telemetry.result.geofenceTriggered)"

# Verify status is ARRIVED_AT_CUSTOMER_AREA (and NOT DELIVERED)
$delStatus = Invoke-RestMethod -Uri "$baseUrl/deliveries/$delId" -Method GET -Headers $d2Headers
Write-Host "Delivery status after geofence: $($delStatus.delivery.status)"

# Driver completes delivery with proof of delivery
$completed = Invoke-RestMethod -Uri "$baseUrl/deliveries/$delId/complete" -Method POST -Headers $d2Headers -Body (@{
    proofOfDelivery = @{
        method = "SIGNATURE"
        recipientName = "Dan Cohen"
        notes = "Handed directly"
    }
} | ConvertTo-Json)
Write-Host "Final delivery status: $($completed.delivery.status)"
```

---

## 5. Smart Batching Proposal & Approval Workflow

```powershell
# Suggest batches
$batchResp = Invoke-RestMethod -Uri "$baseUrl/deliveries/batches/suggest" -Method POST -Headers $mgrHeaders
$batchResp.batches | Format-Table id, status, strategy, score

if ($batchResp.batches.Count -gt 0) {
    $batchId = $batchResp.batches[0].id
    # Manager approves batch
    $approved = Invoke-RestMethod -Uri "$baseUrl/deliveries/batches/$batchId/approve" -Method POST -Headers $mgrHeaders
    Write-Host "Batch Approved: $($approved.batch.status)"
}
```
