# RestaurantOS: Phase 4 Delivery Peak Load & Stress Testing Runbook

This guide details load testing scenarios for peak restaurant rush hours (e.g. Friday evening 19:30-21:30), evaluating the system under high concurrency across dispatch, self-assignment race conditions, queue position stability, and batch generation.

---

## 1. Load Profile Parameters

- **Concurrent Active Drivers:** 50 - 150 drivers per branch.
- **Inbound Orders / Deliveries:** 200 - 500 orders/hour.
- **Telemetry Ingestion Rate:** 1 packet every 5 seconds per vehicle (~30 packets/second peak).
- **Batching Frequency:** Every 60 seconds.

---

## 2. Peak Scenarios & Stress Assertions

### Scenario A: High-Concurrency Driver Queue Contention
- **Load:** 50 drivers simultaneously calling `POST /drivers/me/clock-in` within a 1-second window.
- **Target Invariant:** Zero duplicate queue positions; deterministic tie-breaking via ID sorting; `available_since` correctly preserved.

### Scenario B: Hot Delivery Self-Assignment Stampede
- **Load:** 20 drivers simultaneously issuing `POST /deliveries/{id}/self-assign` for a single high-priority delivery.
- **Target Invariant:**
  - Exactly 1 driver receives `200 OK` (assigned).
  - Exactly 19 drivers receive `409 Conflict: DELIVERY_ALREADY_ASSIGNED`.
  - Database row lock (`FOR UPDATE`) or optimistic version check prevents multiple assignments.
  - Zero orphan state transitions in `delivery_assignment_history`.

### Scenario C: Telemetry Firehose & Geofence Processing
- **Load:** Ingestion of 1,000 GPS packets across 100 vehicles in under 3 seconds.
- **Target Invariant:**
  - Fast ingestion path (<15ms per packet).
  - Geofence calculation (Haversine 150m boundary) executed efficiently.
  - State advances to `ARRIVED_AT_CUSTOMER_AREA` without deadlocks.
  - Zero deliveries incorrectly marked `DELIVERED`.

### Scenario D: High-Volume Smart Batching Computation
- **Load:** 100 concurrent unassigned deliveries evaluated for batching.
- **Target Invariant:**
  - Heuristic combinatorial evaluation completes under 50ms.
  - Azimuth filter strictly rejects batches with diverging vectors (>90° angular difference).
  - All proposals logged to `intelligence_decision_logs` with complete factor breakdown.

---

## 3. Automated Load Test Execution Script

```powershell
# Peak Concurrency Self-Assignment Stress Test
$delId = "del_peak_stress_test_001"
$drivers = 1..20 | ForEach-Object { "usr-stress-driver-$_" }

$jobs = $drivers | ForEach-Object {
    Start-Job -ScriptBlock {
        param($driverId, $delId, $baseUrl)
        try {
            $resp = Invoke-RestMethod -Uri "$baseUrl/deliveries/$delId/self-assign" -Method POST -Headers @{
                "x-user-id" = $driverId
                "x-organization-id" = "org-stress-test"
                "x-branch-id" = "branch-stress-1"
            }
            return @{ status = 200; driver = $driverId }
        } catch {
            return @{ status = 409; driver = $driverId; error = $_.Exception.Message }
        }
    } -ArgumentList $_, $delId, "http://localhost:3000/api/v1"
}

$results = $jobs | ForEach-Object { Receive-Job -Job $_ -Wait }
$successCount = ($results | Where-Object { $_.status -eq 200 }).Count
$conflictCount = ($results | Where-Object { $_.status -eq 409 }).Count

Write-Host "Successes (Assigned): $successCount (Expected: 1)"
Write-Host "Conflicts (Rejected): $conflictCount (Expected: 19)"
```
