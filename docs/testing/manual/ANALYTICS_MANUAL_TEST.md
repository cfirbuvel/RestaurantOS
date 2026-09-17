# RestaurantOS — Phase 10 Manual Verification & QA Guide

This guide details manual test procedures for validating the **Analytics, Reporting & Financial Reconciliation** suite (Phase 10) in RestaurantOS.

---

## 1. Automated Verification
Run the Phase 10 unit and integration test suites:
```bash
npx vitest run tests/unit/analytics.spec.ts tests/unit/reporting.spec.ts
```
Expected output: **2 test files passed, 9 tests passed**.

---

## 2. Testing Endpoints & CLI Commands

### 2.1 Executive Sales Dashboard
```bash
curl -X GET "http://localhost:3000/api/v1/analytics/dashboard" \
  -H "Authorization: Bearer <session_token>" \
  -H "x-branch-id: be7c3e30-b28b-4d23-9d78-b56b545351f5"
```
**Verification Points**:
- Returns `grossRevenue`, `netRevenue`, `averageOrderValue`, `totalTax`, `cancellationRate`.
- Cancelled orders must be excluded from `grossRevenue`.
- `channelBreakdown` groups revenues by `WEB`, `KIOSK`, `WOLT`, `10BIS`, `PHONE`.

### 2.2 Kitchen & KDS Performance
```bash
curl -X GET "http://localhost:3000/api/v1/analytics/kitchen" \
  -H "Authorization: Bearer <session_token>" \
  -H "x-branch-id: be7c3e30-b28b-4d23-9d78-b56b545351f5"
```
**Verification Points**:
- Returns `averagePrepTimeMinutes`, `slaExceededRate`, and `stationThroughput` by station (`GRILL`, `SIDES`, `DRINKS`).

### 2.3 Hourly Heatmap & Peak Hours
```bash
curl -X GET "http://localhost:3000/api/v1/analytics/heatmap" \
  -H "Authorization: Bearer <session_token>" \
  -H "x-branch-id: be7c3e30-b28b-4d23-9d78-b56b545351f5"
```
**Verification Points**:
- Returns 168 data points (7 days × 24 hours).
- Returns `peakHours.busiestHours` and `peakHours.quietHours`.

### 2.4 End of Day (EOD) Z-Report Generation
```bash
curl -X GET "http://localhost:3000/api/v1/analytics/reports/eod?branchId=be7c3e30-b28b-4d23-9d78-b56b545351f5" \
  -H "Authorization: Bearer <session_token>"
```
**Verification Points**:
- Returns immutable snapshot with report number format: `Z-YYYYMMDD-BRANCH`.
- Includes `grossSales`, `netSales`, `vatCollected`, `tipsTotal`, and `paymentBreakdown`.
- Second call retrieves the exact cached snapshot.

### 2.5 Cash Drawer Session Reconciliation
1. **Open Session**:
```bash
curl -X POST "http://localhost:3000/api/v1/analytics/cash-drawer" \
  -H "Authorization: Bearer <session_token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "OPEN", "branchId": "be7c3e30-b28b-4d23-9d78-b56b545351f5", "openingFloat": 500}'
```
2. **Close Session & Calculate Variance**:
```bash
curl -X POST "http://localhost:3000/api/v1/analytics/cash-drawer" \
  -H "Authorization: Bearer <session_token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "CLOSE", "sessionId": "<session_id>", "countedCash": 612, "notes": "Shift close"}'
```
**Verification Points**:
- `expectedCash` equals `openingFloat + cash_sales`.
- `cashVariance` computed as `countedCash - expectedCash`.

---

## 3. UI Dashboard Verification
1. Navigate to `http://localhost:3000`.
2. Click on the **אנליטיקה, דוחות Z & רווחיות (Phase 10)** navigation tab.
3. Test the interactive subtabs:
   - **מדדי מכירות (KPIs)**: Verify cards and breakdowns.
   - **מפת עומסים (Heatmap)**: Verify color coding for peak vs quiet hours.
   - **דוח Z והתאמת קופה**: Enter a counted cash value and observe the live variance calculation (balanced / within tolerance / discrepancy).
   - **עלות המכר (COGS)**: Verify food cost percentage and BOM recipe margins.
   - **יומן החלטות AI (Phase 00 Sec 13)**: Verify advisory recommendation approval and override rates.
