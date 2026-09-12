# ADR 0009: Vehicle Fleet Tracking & Telemetry Architecture

**Status:** Accepted  
**Date:** 2026-09-12  
**Deciders:** Lead Systems Architect, Security Architect, Logistics Lead  

---

## Context
RestaurantOS manages delivery operations involving multi-modal vehicle fleets (scooters, bicycles, cars, vans). In Generation 1, we require accurate dispatch visibility, geofencing, and driver route monitoring. We must design a fleet tracking architecture that:
1. Prevents tight coupling between drivers, vehicles, and tracking hardware.
2. Supports hardware-agnostic IoT telematics providers.
3. Distinguishes raw physical sensor telemetry from operational business truth.
4. Protects employee privacy and complies with data minimization laws.

## Decision
We establish the following architectural policies for fleet tracking and telematics:

1. **First-Class Domain Separation:**
   - **`Vehicle`:** Represents the physical transport asset (type, license plate, make, model, capacity).
   - **`Tracker`:** Represents the telematics IoT device (IMEI, device ID, battery, firmware, vendor).
   - **`DriverVehicleAssignment`:** Temporal M:N relationship tracking which driver is currently operating which vehicle.
   - **`VehicleTrackerAssignment`:** Temporal M:N relationship tracking which tracker is currently mounted on which vehicle.

2. **Primary vs Secondary Telematics Standards:**
   - **Primary Operational Fleet Telemetry:** Continuous active GPS + Cellular/LTE telematics providing sub-minute location updates, speed, heading, and battery telemetry.
   - **Secondary / Backup Anti-Theft:** Bluetooth crowd-sourced tracking (e.g. Apple AirTag / Find My network) is categorized strictly as secondary anti-theft asset recovery and MUST NOT be used as the primary real-time operational dispatch telemetry source.

3. **Hardware Provider Abstraction:**
   - The Integration Hub defines `ITrackerAdapter` with methods `getDeviceStatus()`, `getLatestLocation()`, `subscribeToTelemetry()`, `processWebhook()`, and `normalizeTelemetry()`.
   - Core domain logic consumes canonical `VehicleLocationReceived` events only.
   - A `MockTrackerAdapter` provides deterministic simulation for automated CI testing.

4. **Telemetry $\neq$ Business Truth Principle:**
   - Physical vehicle GPS entering a customer geofence emits `VehicleEnteredCustomerGeofence` and may advance delivery state to `ARRIVED_AT_CUSTOMER_AREA`.
   - GPS telemetry NEVER automatically marks a delivery as `DELIVERED`.
   - Delivery completion in Generation 1 remains a business event requiring human verification (driver confirmation with optional photo/signature Proof of Delivery).

5. **Privacy & Data Minimization:**
   - Telemetry is collected solely during active delivery shifts.
   - Raw location pings are stored in a partitioned `vehicle_locations` table with a 30-day rolling data lifecycle retention policy, aggregating older trips into summarized distance/duration records.

## Consequences
- **Positive:** Hardware vendor independence, zero data corruption when trackers or vehicles are swapped, mathematically safe business state transitions, strict privacy compliance.
- **Negative:** Requires temporal joins to resolve the active `Driver -> Vehicle -> Tracker` hierarchy at any historical point in time.
