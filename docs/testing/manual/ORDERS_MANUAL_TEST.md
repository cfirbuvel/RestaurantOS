# RestaurantOS — Phase 2 Manual Verification Guide
## CRM, Address Intelligence, Menu Catalog & Universal Orders

**Document ID:** `MANUAL-TEST-002`  
**Phase:** `PHASE 2 — CRM, Menu & Universal Orders`  
**Base URL:** `http://localhost:3000/api/v1`

---

## Pre-Requisites

1. Next.js server running locally: `npm run dev` on `http://localhost:3000`.
2. Active session token for authentication. Use the seeded Owner credentials:
   - Email: `owner@restotest.co.il`
   - Password: `SecurePassword123!` (or `NewSecurePassword1!` if password reset was run in Phase 1)
3. Target Branch ID: `be7c3e30-b28b-4d23-9d78-b56b545351f5` (Israeli Burgers - Main).

---

### Step 0: Obtain Authentication Token & Enable UTF-8

> [!NOTE]
> Windows PowerShell (5.1) defaults to ASCII/ISO-8859-1 for console output and HTTP request bodies, which causes Hebrew characters to be sent as `????` or displayed as `×× ×`. Setting UTF-8 encoding and passing `-Body ([System.Text.Encoding]::UTF8.GetBytes($json))` ensures proper Hebrew encoding.

**PowerShell:**
```powershell
# Configure PowerShell for UTF-8 input/output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$loginBody = @{
    email = "owner@restotest.co.il"
    password = "SecurePassword123!" # or "NewSecurePassword1!"
} | ConvertTo-Json -Compress

$loginRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($loginBody)) -ContentType "application/json; charset=utf-8"
$headers = @{ Authorization = "Bearer " + $loginRes.session.token }
Write-Host "Logged in as:" $loginRes.user.email "Role:" $loginRes.session.role
```

---

### 1. CRM & Customer Management

#### 1.1 Search Customers & Seed Profile Lookup

**PowerShell:**
```powershell
# Search for seeded customer "דני כהן"
$crmRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/crm/customers?q=דני" -Method Get -Headers $headers
$crmRes.customers | Format-Table id, first_name, last_name, phone, is_vip, total_spent_amount
```

- **Expected Result:** `200 OK` returning array with seeded customer `דני כהן`, `phone: 054-9876543`, `is_vip: True`.

#### 1.2 Create New Customer Profile
 
 **PowerShell:**
 ```powershell
 $newCustBody = @{
     phone = "050-9988776"
     firstName = "נועה"
     lastName = "שחר"
     email = "noa@example.com"
     allergies = @("שומשום")
     preferences = @{ spicy = "לא חריף" }
     internalNotes = "לקוחה חדשה"
 } | ConvertTo-Json -Compress
 
 $newCust = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/crm/customers" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($newCustBody)) -ContentType "application/json; charset=utf-8" -Headers $headers
 $newCust.customer | Format-List
 ```
 
 - **Expected Result:** `201 Created` with customer profile object.
 
 #### 1.3 Add Address with Intelligence Details (Floor, Gate Code, Delivery Notes)
 
 **PowerShell:**
 ```powershell
 $custId = $newCust.customer.id
 $addrBody = @{
     street = "אבן גבירול"
     houseNumber = "78"
     entrance = "א"
     floor = "4"
     apartment = "14"
     city = "תל אביב"
     gateCode = "2468#"
     parkingInstructions = "יש חניה בכחול-לבן מול הבניין"
     deliveryNotes = "נא להשאיר ליד הדלת ולא לצלצל"
     isDefault = $true
 } | ConvertTo-Json -Compress
 
 $addrRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/crm/customers/$custId/addresses" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($addrBody)) -ContentType "application/json; charset=utf-8" -Headers $headers
 $addrRes.address | Format-List
 ```

- **Expected Result:** `201 Created` with structured address details.

---

### 2. Menu Catalog & Branch Availability

#### 2.1 Query Menu Categories & Products

**PowerShell:**
```powershell
# Categories
$cats = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/menu/categories" -Method Get -Headers $headers
$cats.categories | Format-Table id, name, sort_order

# Products in Main Branch
$prods = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/menu/products?branchId=be7c3e30-b28b-4d23-9d78-b56b545351f5" -Method Get -Headers $headers
$prods.products | Format-Table id, name, base_price, is_active
```

- **Expected Result:**
  - Categories: `המבורגרים`, `תוספות`, `שתייה`.
  - Products: `המבורגר קלאסי 220 גרם` (58 ₪), `צ'יפס בלגי פריך` (22 ₪), `קוקה קולה 330 מ"ל` (12 ₪).

---

### 3. Universal Order Creation & Price Breakdown

#### 3.1 Place Delivery Order (with Modifiers & Variant)

**PowerShell:**
```powershell
$orderBody = @{
    branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5"
    customerId = $newCust.customer.id
    deliveryAddressId = $addrRes.address.id
    channel = "WEB"
    orderType = "DELIVERY"
    deliveryFee = 15.0
    tipAmount = 10.0
    notes = "נא לצרף הרבה רטבים"
    items = @(
        @{
            productId = "prod-01-classic-burger"
            quantity = 1
            selectedModifiers = @(
                @{ modifierId = "mod-mw" },
                @{ modifierId = "mod-cheddar" } # +8 ILS
            )
        },
        @{
            productId = "prod-02-fries"
            quantity = 1
        }
    )
} | ConvertTo-Json -Depth 5 -Compress

$orderRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($orderBody)) -ContentType "application/json; charset=utf-8" -Headers $headers
$orderRes.order | Format-List
```

- **Expected Result:**
  - `201 Created`
  - `status: "DRAFT"`
  - `subtotal: 88.00` (Burger 58 + Cheddar 8 + Fries 22)
  - `total_amount: 113.00` (Subtotal 88 + Delivery 15 + Tip 10)
  - `items`: 2 line items with formatted modifier details.

---

### 4. Canonical Order Lifecycle (Explicit Domain Commands)

#### Step 4A — Confirm Order (`POST /api/v1/orders/:id/confirm`)

```powershell
$orderId = $orderRes.order.id
$confirmRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/$orderId/confirm" -Method Post -Headers $headers
Write-Host "Status:" $confirmRes.order.status "Payment:" $confirmRes.order.payment_status
```
- **Expected Result:** `200 OK` — `status: "CONFIRMED"`, `payment_status: "PAID"`.

#### Step 4B — Accept Order by Kitchen (`POST /api/v1/orders/:id/accept`)

```powershell
$acceptBody = @{ estimatedPrepMinutes = 25 } | ConvertTo-Json
$acceptRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/$orderId/accept" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($acceptBody)) -ContentType "application/json; charset=utf-8" -Headers $headers
Write-Host "Status:" $acceptRes.order.status "Ready At:" $acceptRes.order.estimated_ready_at
```
- **Expected Result:** `200 OK` — `status: "ACCEPTED"`, `estimated_ready_at` set 25 mins ahead.

#### Step 4C — Start Preparation (`POST /api/v1/orders/:id/start-preparation`)

```powershell
$prepRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/$orderId/start-preparation" -Method Post -Headers $headers
Write-Host "Status:" $prepRes.order.status
```
- **Expected Result:** `200 OK` — `status: "IN_PREPARATION"`.

#### Step 4D — Mark Ready (`POST /api/v1/orders/:id/ready`)

```powershell
$readyRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/$orderId/ready" -Method Post -Headers $headers
Write-Host "Status:" $readyRes.order.status "Actual Ready:" $readyRes.order.actual_ready_at
```
- **Expected Result:** `200 OK` — `status: "READY"`, `actual_ready_at` recorded.

#### Step 4E — Complete Order (`POST /api/v1/orders/:id/complete`)

```powershell
$completeRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/$orderId/complete" -Method Post -Headers $headers
Write-Host "Status:" $completeRes.order.status "Completed At:" $completeRes.order.completed_at
```
- **Expected Result:**
  - `200 OK` — `status: "COMPLETED"`.
  - Customer LTV updated (orders count incremented, total spent updated).

---

### 5. Negative Test: Invalid State Transitions

Attempting to complete or ready an order directly from `DRAFT` or cancelling a `COMPLETED` order:

```powershell
# Attempt to cancel completed order
try {
    $cancelBody = @{ reason = "Mistake" } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/$orderId/cancel" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($cancelBody)) -ContentType "application/json; charset=utf-8" -Headers $headers
} catch {
    $_.Exception.Response.StatusCode.Value__
    $_.Exception.Message
}
```
- **Expected Result:** `400 Bad Request` — `"Cannot cancel order in status COMPLETED"`.

---

### 6. Courier Data Minimization (`DeliveryViewDTO`)

When a user with `DRIVER` role inspects the order:

- Customer's phone number is masked: `050-***9988`.
- Full CRM metrics (total spent, LTV, internal notes, birthdate) are **stripped**.
- Operational details (street, house number, floor, gate code `2468#`, delivery notes) are visible.

---

### Summary Checklist

| # | Test Scenario | Expected Outcome | Status |
|---|---------------|------------------|--------|
| 1 | Customer Lookup & Create | 201 profile created, phone indexed | Passed |
| 2 | Address with Gate Code & Instructions | 201 structured address persisted | Passed |
| 3 | Menu Catalog with Modifiers | Products, variants & modifiers queried | Passed |
| 4 | Universal Order Creation & Pricing | 201 with subtotal + tax + fees | Passed |
| 5 | Canonical Lifecycle (Confirm $\rightarrow$ Complete) | 200 on all domain command transitions | Passed |
| 6 | State Machine Guard Enforcement | 400 when attempting illegal state jumps | Passed |
| 7 | Courier Data Minimization | Operational info only, CRM data stripped | Passed |
