# Phase 5: Inventory, Recipes (BOM), Multi-Warehouse & Waste Manual Test Runbook

This runbook validates all Phase 5 REST endpoints, BOM explosions, stock adjustments, inter-warehouse transfers, purchase orders, goods receipts, waste tracking, and physical stock count reconciliations via PowerShell.

---

## 1. Prerequisites & Manager Login

```powershell
$baseUrl = "http://localhost:3000/api/v1"

# 1. Login as Store Manager
$loginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{
    email = "manager@israeliburgers.co.il"
    password = "Password123!"
} | ConvertTo-Json)

$token = $loginRes.session.token
$orgId = $loginRes.user.organizationId
$branchId = $loginRes.user.branchId

$headers = @{
    "Authorization" = "Bearer $token"
    "x-organization-id" = $orgId
    "x-branch-id" = $branchId
}

Write-Host "✅ Logged in as Manager: $orgId (Branch: $branchId)" -ForegroundColor Green
```

---

## 2. Query Ingredients & Warehouses

```powershell
# 2.1 List Master Ingredients
$ingRes = Invoke-RestMethod -Uri "$baseUrl/inventory/ingredients" -Method GET -Headers $headers
Write-Host "`n📦 Master Ingredients ($($ingRes.ingredients.Count) items):" -ForegroundColor Cyan
$ingRes.ingredients | Format-Table id, name, sku, category, cost_per_unit, currency, minimum_stock_level, reorder_point

# 2.2 List Warehouses
$whRes = Invoke-RestMethod -Uri "$baseUrl/inventory/warehouses" -Method GET -Headers $headers
Write-Host "`n🏬 Warehouses:" -ForegroundColor Cyan
$whRes.warehouses | Format-Table id, name, warehouse_type, is_active
```

---

## 3. Query Stock Levels & Low-Stock Alerts

```powershell
# 3.1 List Kitchen Line Stock
$stocksRes = Invoke-RestMethod -Uri "$baseUrl/inventory/stocks?warehouseId=wh-02-kitchen" -Method GET -Headers $headers
Write-Host "`n📊 Current Kitchen Stock Levels:" -ForegroundColor Cyan
$stocksRes.stocks | Format-Table ingredient_id, quantity, reserved_quantity, available_quantity

# 3.2 Check Low Stock Alerts
$alertRes = Invoke-RestMethod -Uri "$baseUrl/inventory/stocks?lowStock=true" -Method GET -Headers $headers
Write-Host "`n⚠️ Low Stock Alerts:" -ForegroundColor Yellow
$alertRes.lowStockAlerts | Format-Table -Property @{Label="Ingredient"; Expression={$_.ingredient.name}}, currentQuantity, reorderPoint, isCritical
```

---

## 4. Calculate BOM & Theoretical Food Cost

```powershell
# 4.1 Calculate BOM for Classic Burger with Cheddar Modifier (2 Portions)
$bomRes = Invoke-RestMethod -Uri "$baseUrl/inventory/recipes/calculate-bom" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    productId = "prod-01-classic-burger"
    modifierIds = @("mod-cheddar")
    portions = 2
} | ConvertTo-Json)

Write-Host "`n🍔 BOM Explosion for: $($bomRes.bom.recipeName) ($($bomRes.bom.portions) portions)" -ForegroundColor Green
Write-Host "Theoretical Food Cost: ₪$($bomRes.bom.theoreticalFoodCost)" -ForegroundColor Yellow
$bomRes.bom.items | Format-Table ingredientName, sku, quantity, unitId, unitCost, totalCost
```

---

## 5. Stock Adjustment & Negative Stock Guard Validation

```powershell
# 5.1 Manual Stock Adjustment (Add 50 burger buns)
$adjRes = Invoke-RestMethod -Uri "$baseUrl/inventory/stocks/adjust" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    warehouseId = "wh-02-kitchen"
    ingredientId = "ing-02-burger-bun"
    adjustmentQuantity = 50
    unitId = "unit"
    reason = "Manual delivery supplement"
} | ConvertTo-Json)

Write-Host "`n✅ Stock Adjusted: New Quantity = $($adjRes.stock.quantity) units" -ForegroundColor Green
Write-Host "Movement Audit ID: $($adjRes.movement.id)" -ForegroundColor Cyan
```

---

## 6. Inter-Warehouse Transfer Workflow

```powershell
# 6.1 Request Transfer: 20 Buns from Main Warehouse to Kitchen
$transferReq = Invoke-RestMethod -Uri "$baseUrl/inventory/transfers" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    sourceWarehouseId = "wh-01-main"
    destinationWarehouseId = "wh-02-kitchen"
    notes = "Morning line replenishment"
    items = @(
        @{
            ingredientId = "ing-02-burger-bun"
            quantity = 20
            unitId = "unit"
        }
    )
} | ConvertTo-Json)

$transferId = $transferReq.transfer.id
Write-Host "`n🚚 Transfer Created ($($transferReq.transfer.transfer_number)) - Status: $($transferReq.transfer.status)" -ForegroundColor Cyan

# 6.2 Approve & Dispatch Transfer
$dispatchRes = Invoke-RestMethod -Uri "$baseUrl/inventory/transfers/$transferId/approve" -Method POST -Headers $headers
Write-Host "✅ Transfer Dispatched - Status: $($dispatchRes.transfer.status)" -ForegroundColor Green

# 6.3 Complete & Receive Transfer at Kitchen Line
$completeRes = Invoke-RestMethod -Uri "$baseUrl/inventory/transfers/$transferId/complete" -Method POST -Headers $headers
Write-Host "🎉 Transfer Completed - Status: $($completeRes.transfer.status)" -ForegroundColor Green
```

---

## 7. Supplier Purchase Order & Goods Receiving

```powershell
# 7.1 Create Purchase Order with Meat Supplier
$poRes = Invoke-RestMethod -Uri "$baseUrl/inventory/purchase-orders" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    supplierId = "sup-01-meat"
    destinationWarehouseId = "wh-01-main"
    expectedDeliveryDate = "2026-09-25"
    notes = "Weekly fresh meat supply"
    items = @(
        @{
            ingredientId = "ing-01-beef-patty"
            orderedQuantity = 40
            unitId = "kg"
            unitPrice = 75.0
        }
    )
} | ConvertTo-Json)

$poId = $poRes.purchaseOrder.id
Write-Host "`n📋 Purchase Order Created: $($poRes.purchaseOrder.po_number) - Total: ₪$($poRes.purchaseOrder.total_amount)" -ForegroundColor Cyan

# 7.2 Receive Goods against PO
$receiptRes = Invoke-RestMethod -Uri "$baseUrl/inventory/purchase-orders/$poId/receive" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    warehouseId = "wh-01-main"
    idempotencyKey = "manual_test_rcpt_01"
    notes = "All 40kg fresh beef received in good condition"
    items = @(
        @{
            ingredientId = "ing-01-beef-patty"
            quantity = 40
            unitId = "kg"
            unitCost = 75.0
        }
    )
} | ConvertTo-Json)

Write-Host "✅ Goods Received: Receipt #$($receiptRes.receipt.receipt_number)" -ForegroundColor Green
```

---

## 8. Waste Tracking & Spoilage Recording

```powershell
# 8.1 Record Spoilage Waste
$wasteRes = Invoke-RestMethod -Uri "$baseUrl/inventory/waste" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    warehouseId = "wh-02-kitchen"
    ingredientId = "ing-03-cheddar-slice"
    quantity = 8
    unitId = "unit"
    wasteReason = "SPOILED"
    notes = "Opened package left out overnight"
} | ConvertTo-Json)

Write-Host "`n🗑️ Waste Recorded: Cost Impact = ₪$($wasteRes.wasteRecord.cost_impact)" -ForegroundColor Yellow

# 8.2 Get Waste Summary
$summaryRes = Invoke-RestMethod -Uri "$baseUrl/inventory/waste" -Method GET -Headers $headers
Write-Host "📊 Total Waste Loss: ₪$($summaryRes.summary.totalCostImpact)" -ForegroundColor Red
```

---

## 9. Physical Stock Count & Reconciliation

```powershell
# 9.1 Record Physical Count Session
$countRes = Invoke-RestMethod -Uri "$baseUrl/inventory/counts" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    warehouseId = "wh-02-kitchen"
    notes = "Weekly manager count audit"
    items = @(
        @{
            ingredientId = "ing-02-burger-bun"
            countedQuantity = 240
            unitId = "unit"
        }
    )
} | ConvertTo-Json)

$countId = $countRes.count.id
Write-Host "`n📝 Count Session Recorded ($($countRes.count.count_number)):" -ForegroundColor Cyan
$countRes.count.items | Format-Table ingredient_id, system_quantity, counted_quantity, variance, variance_cost

# 9.2 Reconcile Count Discrepancies
$reconcileRes = Invoke-RestMethod -Uri "$baseUrl/inventory/counts/$countId/reconcile" -Method POST -Headers $headers
Write-Host "✅ Count Reconciled! Adjustments Applied = $($reconcileRes.adjustmentsApplied)" -ForegroundColor Green
```
