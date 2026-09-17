# Phase 6: Campaigns, Promotions, Coupons & Customer Loyalty Manual Test Runbook

This runbook validates all Phase 6 REST API endpoints, campaign state transitions, coupon validation & atomic redemptions, deterministic promotion evaluation, and customer loyalty tier progressions (לקוח חדש, לקוח קבוע, לקוח VIP) via PowerShell.

> **Note**: All `ConvertTo-Json` calls use `-Depth 10` to prevent PowerShell's default depth-2 truncation of nested objects.

---

## 1. Prerequisites & Marketing Manager Login

```powershell
$baseUrl = "http://localhost:3000/api/v1"

# 1. Login as Marketing Manager / Store Manager
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

Write-Host "✅ Logged in as Manager: $orgId (Branch: $branchId)" -ForegroundColor Green
Write-Host "   Role: $($loginRes.session.role)" -ForegroundColor DarkGray
Write-Host "   Token: $($token.Substring(0, 16))..." -ForegroundColor DarkGray

if (-not $orgId) {
    Write-Host "❌ FATAL: organizationId is empty — login response does not include org context." -ForegroundColor Red
    Write-Host "   Full response:" -ForegroundColor Red
    $loginRes | ConvertTo-Json -Depth 5
    return
}
```

---

## 2. Campaign Lifecycle & State Transitions

```powershell
# 2.1 Create Campaign Draft
$createCampRes = Invoke-RestMethod -Uri "$baseUrl/campaigns" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    name = "Summer Burger Special 2026"
    description = "Special promotion for summer season"
    type = "PROMOTIONAL"
    budgetLimit = 5000
} | ConvertTo-Json)

$campaignId = $createCampRes.campaign.id
Write-Host "`n📢 Created Campaign Draft: $campaignId (Status: $($createCampRes.campaign.status))" -ForegroundColor Cyan        

# 2.2 Schedule Campaign
$scheduleRes = Invoke-RestMethod -Uri "$baseUrl/campaigns/$campaignId/schedule" -Method POST -Headers $headers
Write-Host "🗓️ Scheduled Campaign: (Status: $($scheduleRes.campaign.status))" -ForegroundColor Yellow

# 2.3 Activate Campaign
$activateRes = Invoke-RestMethod -Uri "$baseUrl/campaigns/$campaignId/activate" -Method POST -Headers $headers
Write-Host "🟢 Activated Campaign: (Status: $($activateRes.campaign.status))" -ForegroundColor Green

# 2.4 Dispatch Campaign to Audience
$dispatchRes = Invoke-RestMethod -Uri "$baseUrl/campaigns/$campaignId/dispatch" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    customers = @(
        @{ id = "cust_01"; phone = "+972501234567"; email = "yossi@example.com" },
        @{ id = "cust_02"; phone = "+972529876543"; email = "danny@example.com" }
    )
    message = "15% off all burgers today! Use code SUMMER15"
    channels = @("SMS", "WHATSAPP")
} | ConvertTo-Json)
Write-Host "🚀 Dispatched to $($dispatchRes.dispatchedCount) recipients via configured channels" -ForegroundColor Cyan

# 2.5 Pause Campaign
$pauseRes = Invoke-RestMethod -Uri "$baseUrl/campaigns/$campaignId/pause" -Method POST -Headers $headers
Write-Host "⏸️ Paused Campaign: (Status: $($pauseRes.campaign.status))" -ForegroundColor Yellow

```

---

## 3. Coupon Creation, Validation & Redemption

```powershell
# 3.1 Create Reusable Coupon
$couponRes = Invoke-RestMethod -Uri "$baseUrl/coupons" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    code = "SUMMER15"
    discountType = "PERCENTAGE"
    discountValue = 15
    maxDiscountAmount = 30
    minOrderAmount = 50
    usageLimitGlobal = 500
    usageLimitPerCustomer = 2
} | ConvertTo-Json -Depth 10)

Write-Host "`n🎟️ Created Coupon: $($couponRes.coupon.code) (15% off, max 30 ILS)" -ForegroundColor Cyan

# 3.2 Validate Coupon Before Checkout
$valRes = Invoke-RestMethod -Uri "$baseUrl/coupons/validate" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    code = "SUMMER15"
    customerId = "cust_01"
    orderSubtotal = 120
    branchId = $branchId
    channel = "WEB"
} | ConvertTo-Json -Depth 10)

Write-Host "🔍 Validation Result: Valid=$($valRes.valid), Discount Calculated=$($valRes.calculatedDiscount) ILS" -ForegroundColor Green

# 3.3 Redeem Coupon on Order
$redeemRes = Invoke-RestMethod -Uri "$baseUrl/coupons/redeem" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    couponCode = "SUMMER15"
    customerId = "cust_01"
    orderId = "ord_test_001"
    orderSubtotal = 120
    branchId = $branchId
    channel = "WEB"
} | ConvertTo-Json -Depth 10)

Write-Host "💰 Redeemed Coupon: Applied $($redeemRes.redemption.discount_applied) ILS discount" -ForegroundColor Green
```

---

## 4. Promotion Engine & Deterministic Rule Evaluation

```powershell
# 4.1 Create First-Order Promotion
$promoRes = Invoke-RestMethod -Uri "$baseUrl/promotions" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    name = "First Order Welcome Discount"
    description = "20% off for all first-time customers"
    discountType = "PERCENTAGE"
    discountValue = 20
    maxDiscountAmount = 40
    minOrderAmount = 60
    priority = 100
    stackMode = "BEST_DEAL"
    conditions = @(
        @{ field = "is_first_order"; operator = "EQUALS"; value = $true }
    )
} | ConvertTo-Json -Depth 10)

Write-Host "`n⚡ Created Promotion Rule: $($promoRes.promotion.name)" -ForegroundColor Cyan

# 4.2 Evaluate Active Promotions Against Order Context
$evalRes = Invoke-RestMethod -Uri "$baseUrl/promotions/evaluate" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    branchId = $branchId
    channel = "WEB"
    orderType = "DELIVERY"
    customerId = "cust_new_01"
    customerProfile = @{
        isFirstOrder = $true
        totalOrdersCount = 0
        totalSpentAmount = 0
        isVip = $false
        isBirthday = $false
    }
    items = @(
        @{ productId = "prod_burger_classic"; quantity = 2; unitPrice = 55 }
    )
    subtotal = 110
} | ConvertTo-Json -Depth 10)

Write-Host "🎯 Promotion Evaluation Result:" -ForegroundColor Cyan
Write-Host "   Total Discount: $($evalRes.totalDiscount) ILS" -ForegroundColor Green
Write-Host "   Applied Promos: $($evalRes.appliedPromotions.Count)" -ForegroundColor Green
$evalRes.explanations | ForEach-Object { Write-Host "   - $_" -ForegroundColor DarkGray }
```

---

## 5. Loyalty Points Engine & 3-Tier System

```powershell
# 5.1 Configure Tenant Loyalty Program
$progRes = Invoke-RestMethod -Uri "$baseUrl/loyalty/program" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    name = "Burger Club"
    pointsDisplayName = "נקודות"
    pointsPerCurrencyUnit = 1.0
    currencyPerPoint = 0.10
    regularThreshold = 500
    vipThreshold = 2000
    pointsExpiryDays = 365
} | ConvertTo-Json -Depth 10)

Write-Host "`n⭐ Configured Loyalty Program:" -ForegroundColor Cyan
Write-Host "   Points Name: $($progRes.program.points_display_name)"
Write-Host "   Tiers: לקוח חדש (0) -> לקוח קבוע ($($progRes.program.regular_threshold)) -> לקוח VIP ($($progRes.program.vip_threshold))"

# 5.2 Query Customer Loyalty Account
$custAccountRes = Invoke-RestMethod -Uri "$baseUrl/loyalty/accounts/cust_01" -Method GET -Headers $headers
Write-Host "`n👤 Customer Account: Balance=$($custAccountRes.account.current_points) pts, Tier=$($custAccountRes.account.current_tier) ($($custAccountRes.tierLabelHe))" -ForegroundColor Cyan

# 5.3 Redeem Points for Checkout
if ($custAccountRes.account.current_points -ge 50) {
    $redeemPtsRes = Invoke-RestMethod -Uri "$baseUrl/loyalty/accounts/cust_01/redeem" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
        points = 50
        orderId = "ord_test_002"
        description = "Redeemed 50 points on checkout"
    } | ConvertTo-Json -Depth 10)
    Write-Host "💳 Redeemed 50 points for $($redeemPtsRes.currencyValue) ILS discount" -ForegroundColor Green
}

# 5.4 View Customer Points Transaction History
$historyRes = Invoke-RestMethod -Uri "$baseUrl/loyalty/accounts/cust_01/history?limit=10" -Method GET -Headers $headers
Write-Host "`n📜 Points History ($($historyRes.total) transactions):" -ForegroundColor Cyan
$historyRes.data | Format-Table id, type, points, balance_after, description, created_at
```

---

## 6. Customer Segments for Marketing Targeting

```powershell
# 6.1 Create VIP Inactive Customers Segment
$segRes = Invoke-RestMethod -Uri "$baseUrl/segments" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    name = "At-Risk VIPs"
    description = "VIP customers who haven't ordered in 30 days"
    conditions = @(
        @{ field = "is_vip"; operator = "EQUALS"; value = $true },
        @{ field = "last_order_days_ago"; operator = "GREATER_THAN"; value = 30 }
    )
} | ConvertTo-Json -Depth 10)

$segId = $segRes.segment.id
Write-Host "`n👥 Created Segment: $($segRes.segment.name) ($segId)" -ForegroundColor Cyan

# 6.2 Evaluate Matching Customer IDs
$segEvalRes = Invoke-RestMethod -Uri "$baseUrl/segments/$segId/evaluate" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    customers = @(
        @{ id = "c1"; tenant_id = $orgId; total_orders_count = 50; total_spent_amount = 4500; is_vip = $true; last_order_days_ago = 45 },
        @{ id = "c2"; tenant_id = $orgId; total_orders_count = 20; total_spent_amount = 1200; is_vip = $false; last_order_days_ago = 10 },
        @{ id = "c3"; tenant_id = $orgId; total_orders_count = 35; total_spent_amount = 3200; is_vip = $true; last_order_days_ago = 5 }
    )
} | ConvertTo-Json -Depth 10)

Write-Host "🎯 Matching Segment Customers: $($segEvalRes.matchingCount) customer(s) found" -ForegroundColor Green
Write-Host "   Matching IDs: $($segEvalRes.matchingCustomerIds -join ', ')"
```

---

## 7. Verification Summary

| Subsystem | Key Checks | Expected Result |
| :--- | :--- | :--- |
| **Campaigns** | State transitions & dispatch | `DRAFT` -> `SCHEDULED` -> `ACTIVE` -> `PAUSED` / `CANCELLED` |
| **Coupons** | Caps, limits, rollback | Atomic redemption, exhausted state guard, discount subtotal cap |
| **Promotions** | Deterministic evaluation | Best deal / stacking resolution, first-order eligibility |
| **Loyalty** | 3 Canonical tiers | `NEW_CUSTOMER` (לקוח חדש), `REGULAR` (לקוח קבוע), `VIP` (לקוח VIP) |
| **Segments** | Audience resolution | Accurate multi-condition filtering across customer metrics |
