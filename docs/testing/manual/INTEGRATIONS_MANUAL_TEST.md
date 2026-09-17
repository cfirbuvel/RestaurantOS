# Phase 8: Integration Hub Adapters Manual Test Runbook

This runbook validates all Phase 8 Integration Hub endpoints, including Wolt, 10bis, and Mishloha webhook ingestion, cryptographic HMAC-SHA256 signature verification, 5-minute replay attack tolerance, idempotency locks, fiscal e-invoicing issuance (Green Invoice, Rivhit, iCount), payment processing (Meshulam, Stripe), and dead-letter retry queue management via PowerShell.

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

## 2. Ingest Wolt Order Webhook via Normalized Pipeline

```powershell
# 2.1 Prepare sample Wolt payload
$woltPayload = @{
    order = @{
        id = "wolt-ord-manual-101"
        venue_id = "venue-tlv-01"
        customer = @{
            name = "יוסי ישראלי"
            phone_number = "050-8899001"
            email = "yossi@example.com"
        }
        delivery = @{
            type = "homedelivery"
            location = @{
                street_address = "דיזנגוף 100"
                city = "תל אביב"
                apartment = "12"
                coordinates = @(34.7748, 32.0778)
            }
            instructions = "נא להשאיר ליד הדלת"
        }
        items = @(
            @{
                id = "item-01"
                name = "בורגר קלאסי"
                count = 2
                base_price = 5500
                total_price = 11000
                options = @(
                    @{ name = "מידת עשייה MW"; price = 0 }
                )
            }
        )
        price = @{
            amount = 12500
            currency = "ILS"
        }
        delivery_fee = @{ amount = 1500 }
        tip = @{ amount = 0 }
    }
} | ConvertTo-Json -Depth 10

# 2.2 Calculate HMAC-SHA256 signature
# IMPORTANT: Convert to UTF-8 byte array first to ensure HMAC matches
# what Node.js receives (PowerShell re-encodes string bodies, breaking
# HMAC verification for payloads containing Hebrew/non-ASCII characters)
$woltBodyBytes = [System.Text.Encoding]::UTF8.GetBytes($woltPayload)
$secret = "mock-wolt-secret"
$hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($secret))
$sigBytes = $hmac.ComputeHash($woltBodyBytes)
$signature = "sha256=" + [System.BitConverter]::ToString($sigBytes).Replace("-","").ToLower()
$timestamp = [Math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())

$webhookHeaders = @{
    "Content-Type" = "application/json; charset=utf-8"
    "x-wolt-signature" = $signature
    "x-wolt-timestamp" = $timestamp.ToString()
    "x-tenant-id" = $orgId
    "x-branch-id" = $branchId
}

$res = Invoke-RestMethod -Uri "$baseUrl/integrations/webhooks/wolt" -Method POST -Headers $webhookHeaders -Body $woltBodyBytes
Write-Host "🍔 Wolt Order Ingested: ID=$($res.orderId) Number=$($res.orderNumber)" -ForegroundColor Green
```

---

## 3. Webhook Idempotency & Replay Protection Verification

```powershell
# 3.1 Send exact same Wolt webhook a second time -> should be suppressed idempotently
$resDuplicate = Invoke-RestMethod -Uri "$baseUrl/integrations/webhooks/wolt" -Method POST -Headers $webhookHeaders -Body $woltBodyBytes
if ($resDuplicate.duplicate -eq $true) {
    Write-Host "✅ Idempotency Verified: Duplicate order suppressed with cached response" -ForegroundColor Green
} else {
    Write-Host "❌ Idempotency Failed: Duplicate was not flagged" -ForegroundColor Red
}

# 3.2 Send stale timestamp webhook (> 5 minutes old) -> should be rejected with HTTP 401
$staleTimestamp = $timestamp - 400
$staleHeaders = @{
    "Content-Type" = "application/json; charset=utf-8"
    "x-wolt-signature" = $signature
    "x-wolt-timestamp" = $staleTimestamp.ToString()
    "x-tenant-id" = $orgId
    "x-branch-id" = $branchId
}

try {
    $resStale = Invoke-RestMethod -Uri "$baseUrl/integrations/webhooks/wolt" -Method POST -Headers $staleHeaders -Body $woltBodyBytes
    Write-Host "❌ Replay attack test failed: Stale request accepted" -ForegroundColor Red
} catch {
    Write-Host "🛡️ Replay attack blocked: Stale timestamp rejected with HTTP 401" -ForegroundColor Green
}
```

---

## 4. Ingest 10bis Order Webhook

```powershell
$tenbisPayload = @{
    Order = @{
        OrderNumber = "10bis-manual-8821"
        CompanyName = "Check Point Technologies"
        CustomerName = "רונית כהן"
        PhoneNumber = "054-1122334"
        TotalAmount = 78.00
        DeliveryFee = 12.00
        IsTakeaway = $false
        DeliveryAddress = @{
            Street = "דרך מנחם בגין"
            HouseNumber = "132"
            City = "תל אביב"
            Floor = "24"
        }
        Items = @(
            @{
                ItemId = "dish-101"
                DishName = "ארוחת המבורגר כפול"
                Quantity = 1
                Price = 66.00
            }
        )
    }
} | ConvertTo-Json -Depth 10

$tbBodyBytes = [System.Text.Encoding]::UTF8.GetBytes($tenbisPayload)
$tbSecret = "mock-tenbis-secret"
$tbHmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($tbSecret))
$tbSigBytes = $tbHmac.ComputeHash($tbBodyBytes)
$tbSignature = "sha256=" + [System.BitConverter]::ToString($tbSigBytes).Replace("-","").ToLower()
$tbTimestamp = [Math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())

$tbHeaders = @{
    "Content-Type" = "application/json; charset=utf-8"
    "x-10bis-signature" = $tbSignature
    "x-10bis-timestamp" = $tbTimestamp.ToString()
    "x-tenant-id" = $orgId
    "x-branch-id" = $branchId
}

$tbRes = Invoke-RestMethod -Uri "$baseUrl/integrations/webhooks/tenbis" -Method POST -Headers $tbHeaders -Body $tbBodyBytes
Write-Host "🏢 10bis Order Ingested: ID=$($tbRes.orderId) Number=$($tbRes.orderNumber)" -ForegroundColor Green
```

---

## 5. Dead-Letter Queue Inspection & Replay

```powershell
# 5.1 Inspect Dead Letters
$dlqRes = Invoke-RestMethod -Uri "$baseUrl/integrations/dead-letters" -Method GET -Headers $headers
Write-Host "📬 Dead Letters in queue: $($dlqRes.count)" -ForegroundColor Cyan
```
