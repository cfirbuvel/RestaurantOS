# Phase 7: Telephony PBX Integration & Caller ID Popup Manual Test Runbook

This runbook validates all Phase 7 Telephony REST API endpoints, PBX webhook ingestion, incoming call simulation, CRM caller ID popup payload resolution, Israeli wiretap compliance greeting check, and call history tracking via PowerShell.

> **Note**: All `ConvertTo-Json` calls use `-Depth 10` to prevent PowerShell's default depth-2 truncation of nested objects.

---

## 1. Prerequisites & Operator / Manager Login

```powershell
$baseUrl = "http://localhost:3000/api/v1"

# 1. Login as Manager / Cashier
$loginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{
    email = "manager@israeliburgers.co.il"
    password = "Password123!"
} | ConvertTo-Json -Depth 10)

$token = $loginRes.session.token
$orgId = $loginRes.user.organizationId
$branchId = $loginRes.user.branchId

$headers = @{
    "Authorization" = "Bearer $token"
    "x-organization-id" = $orgId
    "x-branch-id" = $branchId
}

Write-Host "✅ Logged in as Operator/Manager: $orgId (Branch: $branchId)" -ForegroundColor Green
```

---

## 2. Pre-requisite CRM Customer Setup

```powershell
# Create or ensure test customer with phone number exists in CRM
$custRes = Invoke-RestMethod -Uri "$baseUrl/crm/customers" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    phone = "052-4455667"
    firstName = "דניאל"
    lastName = "גולדשטיין"
    allergies = @("בוטנים")
    internalNotes = "אוהב רוטב שום כפול, לבקש מהשליח לצלצל באינטרקום 12"
} | ConvertTo-Json)

Write-Host "👤 CRM Customer ready: $($custRes.firstName) $($custRes.lastName) (Phone: $($custRes.phone))" -ForegroundColor Cyan
```

---

## 3. Webhook Ingestion & Incoming Call Simulation

```powershell
# 3.1 Simulate Incoming Ringing Call via Operator Simulator Endpoint
$simRes = Invoke-RestMethod -Uri "$baseUrl/telephony/simulate/incoming-call" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    callerNumber = "052-4455667"
    branchId = $branchId
} | ConvertTo-Json)

Write-Host "`n📞 Simulated Call Triggered!" -ForegroundColor Green
Write-Host "   Session ID: $($simRes.sessionId)" -ForegroundColor Yellow
Write-Host "   Caller Number: $($simRes.callerId.callerNumber)" -ForegroundColor Yellow
Write-Host "   Customer Matched: $($simRes.callerId.customer.firstName) $($simRes.callerId.customer.lastName)" -ForegroundColor Cyan
Write-Host "   VIP Status: $($simRes.callerId.customer.isVip)" -ForegroundColor Cyan
Write-Host "   Automated Greeting Played: $($simRes.callLog.automated_greeting_played)" -ForegroundColor Green

# 3.2 Ingest PBX Trunk Webhook directly (PBX Vendor Inbound Event)
$webhookRes = Invoke-RestMethod -Uri "$baseUrl/telephony/webhook?tenantId=$orgId" -Method POST -ContentType "application/json" -Body (@{
    sessionId = "pbx_session_test_99"
    callerNumber = "+972501234567"
    destinationNumber = "035550100"
    direction = "INBOUND"
    timestamp = (Get-Date).ToString("o")
} | ConvertTo-Json)

Write-Host "`n📡 PBX Direct Webhook Processed!" -ForegroundColor Green
Write-Host "   Normalized Phone: $($webhookRes.callerId.callerNumber)" -ForegroundColor Yellow
Write-Host "   Call Status: $($webhookRes.callerId.status)" -ForegroundColor Yellow
```

---

## 4. Call Lifecycle Updates (Answer & Hangup)

```powershell
# 4.1 Update Call Status to ANSWERED
$answerRes = Invoke-RestMethod -Uri "$baseUrl/telephony/webhook?tenantId=$orgId" -Method POST -ContentType "application/json" -Body (@{
    sessionId = "pbx_session_test_99"
    status = "ANSWERED"
    operatorId = $loginRes.user.id
    timestamp = (Get-Date).ToString("o")
} | ConvertTo-Json)

Write-Host "`n🟢 Call Answered by Operator!" -ForegroundColor Green
Write-Host "   Status: $($answerRes.callLog.status)" -ForegroundColor Yellow
Write-Host "   Answered At: $($answerRes.callLog.answered_at)" -ForegroundColor Yellow

# 4.2 Update Call Status to COMPLETED with duration
$completeRes = Invoke-RestMethod -Uri "$baseUrl/telephony/webhook?tenantId=$orgId" -Method POST -ContentType "application/json" -Body (@{
    sessionId = "pbx_session_test_99"
    status = "COMPLETED"
    durationSeconds = 165
    recordingUrl = "https://storage.restaurantos.internal/recordings/call_99.mp3"
    timestamp = (Get-Date).ToString("o")
} | ConvertTo-Json)

Write-Host "`n🔴 Call Completed!" -ForegroundColor Green
Write-Host "   Status: $($completeRes.callLog.status)" -ForegroundColor Yellow
Write-Host "   Duration: $($completeRes.callLog.duration_seconds) seconds" -ForegroundColor Yellow
Write-Host "   Recording: $($completeRes.callLog.recording_url)" -ForegroundColor Yellow
```

---

## 5. Query Call History & Call Logs

```powershell
# 5.1 Query call logs
$callLogs = Invoke-RestMethod -Uri "$baseUrl/telephony/calls?limit=10" -Method GET -Headers $headers

Write-Host "`n📋 Call Logs History ($($callLogs.total) calls found):" -ForegroundColor Cyan
$callLogs.data | ForEach-Object {
    Write-Host "   - [$($_.status)] Caller: $($_.caller_number) | Duration: $($_.duration_seconds)s | Greeting: $($_.automated_greeting_played)" -ForegroundColor Gray
}

# 5.2 Get single call log by ID
if ($callLogs.data.Count -gt 0) {
    $firstId = $callLogs.data[0].id
    $detail = Invoke-RestMethod -Uri "$baseUrl/telephony/calls/$firstId" -Method GET -Headers $headers
    Write-Host "`n🔍 Retrieved Call Log Details for: $firstId" -ForegroundColor Green
    Write-Host "   Session: $($detail.call_session_id)" -ForegroundColor DarkGray
    Write-Host "   Customer ID: $($detail.customer_id)" -ForegroundColor DarkGray
}

Write-Host "`n========================================================" -ForegroundColor Magenta
Write-Host "🎉 PHASE 7 TELEPHONY & CALLER ID TEST COMPLETED!" -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta
```
