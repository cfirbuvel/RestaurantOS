# RestaurantOS — Master Domain Event Catalog

**Document ID:** `DOC-EVT-001`  
**Version:** `1.1.0`  
**Status:** Approved Canonical Contract  
**Pattern:** Transactional Outbox + Redis Pub/Sub Event Bus  

---

## 1. Event Standards & Envelope Format

All domain events in RestaurantOS are strongly typed, immutable, versioned, and scoped to tenant and branch.

### 1.1 Canonical Event Envelope
```json
{
  "eventId": "evt_01J8XK9R...",
  "eventType": "OrderAccepted",
  "version": "1.0",
  "timestamp": "2026-09-12T15:30:00.000Z",
  "tenantId": "org_550e8400-e29b-41d4-a716-446655440000",
  "branchId": "brn_770e8400-e29b-41d4-a716-446655440000",
  "correlationId": "req_01J8XK8P...",
  "causationId": "evt_01J8XK7N...",
  "actor": {
    "actorId": "usr_110e8400-e29b-41d4-a716-446655440000",
    "actorType": "MANAGER"
  },
  "payload": { ... }
}
```

---

## 2. Order Domain Events

*Order events describe the customer's purchase lifecycle (not delivery logistics or cooking station sub-states).*

| Event Name | Trigger / Originating Command | Payload Summary | Primary Consumers |
| :--- | :--- | :--- | :--- |
| `OrderCreated` | `POST /orders` (Web, POS, Kiosk, Phone, Ingestion) | `orderId`, `orderNumber`, `channel`, `orderType`, `items`, `totalAmount` | KDS, Analytics, Audit |
| `OrderConfirmed` | `POST /orders/:id/confirm` (Payment verified) | `orderId`, `paymentStatus`, `confirmedAt` | KDS Station Router, Inventory Policy |
| `OrderAccepted` | `POST /orders/:id/accept` (Manager / Auto-rule) | `orderId`, `estimatedReadyAt`, `acceptedBy` | KDS Rail, Customer Notification |
| `OrderPreparationStarted` | `POST /orders/:id/start-preparation` | `orderId`, `startedAt` | Customer Tracking, Analytics |
| `OrderReady` | `POST /orders/:id/ready` (Kitchen marks ready) | `orderId`, `readyAt`, `orderType` | Delivery Lifecycle (`DeliveryBecameAssignable`), Dispatch, POS |
| `OrderCompleted` | `POST /orders/:id/complete` (Dine-in served / Takeaway collected / Delivery verified) | `orderId`, `completedAt`, `totalAmount` | Inventory Depletion, Loyalty Points, Accounting |
| `OrderCancelled` | `POST /orders/:id/cancel` | `orderId`, `reason`, `cancelledBy`, `refundRequired` | KDS (Ticket Recall), Payment Refund, Waste Log |
| `OrderFailed` | System / Ingestion failure | `orderId`, `errorCode`, `details` | Manager Alert, Support |

---

## 3. Delivery Domain Events

*Delivery events describe the transport and logistics lifecycle of an order.*

| Event Name | Trigger / Originating Command | Payload Summary | Primary Consumers |
| :--- | :--- | :--- | :--- |
| `DeliveryCreated` | Order requiring delivery confirmed | `deliveryId`, `orderId`, `addressId`, `coordinates` | Dispatch Console, Batching Engine |
| `DeliveryBecameAssignable` | Kitchen marks order `READY` | `deliveryId`, `orderId`, `readyAt`, `destination` | Driver Availability Queue, Dispatch |
| `DeliveryAssigned` | Manager assigns driver (`POST /deliveries/:id/assign`) | `deliveryId`, `driverId`, `vehicleId`, `assignedBy` | Driver App, Dispatch, Customer Tracking |
| `DeliverySelfAssigned` | Driver self-assigns (`POST /deliveries/:id/self-assign`) | `deliveryId`, `driverId`, `vehicleId`, `assignedAt` | Dispatch, Other Driver Apps (Lockout) |
| `DeliveryReleased` | Driver releases delivery (`POST /deliveries/:id/release`) | `deliveryId`, `previousDriverId`, `reason` | Driver Queue, Dispatch, Batching Engine |
| `DeliveryPickedUp` | Driver collects food (`POST /deliveries/:id/pickup`) | `deliveryId`, `driverId`, `pickedUpAt` | Customer Notification, Dispatch, Trip Logger |
| `DeliveryDispatched` | Driver leaves branch (`POST /deliveries/:id/start`) | `deliveryId`, `driverId`, `vehicleId`, `dispatchedAt` | Customer Live Tracking, Dispatch |
| `DeliveryArrivedAtCustomerArea` | `POST /deliveries/:id/arrive` or Geofence entry | `deliveryId`, `driverId`, `arrivedAt`, `source` | Customer Notification ("Driver is outside") |
| `DeliveryCompleted` | Driver confirms POD (`POST /deliveries/:id/complete`) | `deliveryId`, `driverId`, `proofUrl`, `completedAt` | Order Domain (`OrderCompleted`), Driver Queue |
| `DeliveryFailed` | Driver reports failed delivery (`POST /deliveries/:id/fail`) | `deliveryId`, `driverId`, `failureReason` | Manager Dispatch Alert, Support |
| `DeliveryCancelled` | Delivery cancelled before dispatch | `deliveryId`, `orderId`, `cancelledBy` | Driver App (De-assign), Dispatch |

---

## 4. Driver & Availability Queue Events

*Driver events track shift status and FIFO queue positioning based on `available_since`.*

| Event Name | Trigger / Originating Command | Payload Summary | Primary Consumers |
| :--- | :--- | :--- | :--- |
| `DriverClockedIn` | `POST /drivers/me/clock-in` | `driverId`, `branchId`, `shiftId`, `clockInAt` | Payroll, Dispatch, Queue Engine |
| `DriverBecameAvailable` | Driver becomes available for assignments | `driverId`, `availableSince`, `branchId` | Dispatch, Driver Queue Engine |
| `DriverEnteredQueue` | Driver clocks in, returns to restaurant, or finishes break | `driverId`, `availableSince`, `queuePosition` | Driver App, Dispatch Console |
| `DriverLeftQueue` | Driver assigned, goes on break, or clocks out | `driverId`, `reason`, `leftAt` | Driver Queue Engine, Dispatch |
| `DriverWentOnBreak` | `POST /drivers/me/break` | `driverId`, `breakStartedAt`, `reason` | Driver Queue (Exclude from FIFO), Dispatch |
| `DriverReturnedFromBreak` | `POST /drivers/me/return-from-break` | `driverId`, `newAvailableSince`, `returnedAt` | Driver Queue (Appends to end of FIFO) |
| `DriverReturnedToRestaurant`| `POST /drivers/me/arrived-at-restaurant` or Geofence | `driverId`, `vehicleId`, `returnedAt`, `source` | Driver Queue (Appends to end of FIFO), Trip |
| `DriverClockedOut` | `POST /drivers/me/clock-out` | `driverId`, `shiftDuration`, `clockOutAt` | Payroll, Dispatch, Analytics |
| `DriverQueueReordered` | Manager overrides queue order | `branchId`, `driverId`, `previousPos`, `newPos`, `reason` | Driver Apps, Dispatch Console, Audit |

---

## 5. Vehicle & Fleet Tracking Events

*Vehicle events track physical fleet hardware telemetry and spatial boundaries.*

| Event Name | Trigger / Originating Command | Payload Summary | Primary Consumers |
| :--- | :--- | :--- | :--- |
| `VehicleLocationReceived` | GPS Telemetry ingest (`POST /telemetry/location`) | `vehicleId`, `trackerId`, `latitude`, `longitude`, `speed`, `heading`, `recordedAt`, `receivedAt` | Live Dispatch Map, Trip Accumulator |
| `VehicleStartedMoving` | Telemetry indicates speed > 5 km/h | `vehicleId`, `latitude`, `longitude`, `startedAt` | Trip Logger, Dispatch |
| `VehicleStopped` | Telemetry indicates zero velocity > 2 min | `vehicleId`, `latitude`, `longitude`, `stoppedAt` | Trip Logger, Idling Monitor |
| `VehicleDepartedRestaurant` | Exited restaurant geofence | `vehicleId`, `branchId`, `departedAt` | Dispatch Telemetry, Trip Tracker |
| `VehicleReturnedToRestaurant`| Entered restaurant geofence | `vehicleId`, `branchId`, `returnedAt` | Dispatch Telemetry, Driver Return Candidate |
| `VehicleEnteredCustomerGeofence`| Entered customer delivery geofence | `vehicleId`, `deliveryId`, `enteredAt` | Dispatch (`DeliveryArrivedAtCustomerArea`) |
| `VehicleExitedCustomerGeofence`| Exited customer delivery geofence | `vehicleId`, `deliveryId`, `exitedAt` | Dispatch, Trip Tracker |
| `DriverVehicleAssigned` | Temporal assignment of driver to vehicle | `assignmentId`, `driverId`, `vehicleId`, `assignedAt` | Fleet Management, Dispatch |
| `DriverVehicleUnassigned` | Driver checks in vehicle at end of shift | `assignmentId`, `driverId`, `vehicleId`, `unassignedAt`| Fleet Management |

---

## 6. Tracker Hardware Events

| Event Name | Trigger / Originating Command | Payload Summary | Primary Consumers |
| :--- | :--- | :--- | :--- |
| `TrackerOnline` | Tracker sends heartbeat/packet | `trackerId`, `provider`, `lastSeenAt`, `firmware` | Hardware Health Monitor |
| `TrackerOffline` | Heartbeat missed > 10 minutes | `trackerId`, `lastSeenAt`, `batteryLevel` | Fleet Alert, Hardware Maintenance |
| `TrackerBatteryLow` | Battery level drops below 20% | `trackerId`, `vehicleId`, `batteryPercent` | Hardware Maintenance Alert |
| `TrackerTamperDetected` | Disconnect or unauthorized removal | `trackerId`, `vehicleId`, `tamperTimestamp` | Security Incident Monitor, Manager Alert |

---

## 7. Delivery Batch Events

| Event Name | Trigger / Originating Command | Payload Summary | Primary Consumers |
| :--- | :--- | :--- | :--- |
| `DeliveryBatchSuggested` | Heuristic engine clusters compatible orders | `batchId`, `deliveryIds`, `score`, `scoringBreakdown` | Dispatch Console (Awaiting Human Approval) |
| `DeliveryBatchApproved` | Manager approves batch (`POST /batches/:id/approve`) | `batchId`, `approvedBy`, `driverId`, `vehicleId` | Driver App, Dispatch, Delivery Domain |
| `DeliveryBatchRejected` | Manager rejects batch (`POST /batches/:id/reject`) | `batchId`, `rejectedBy`, `reason` | Decision Logger (Training Telemetry), Dispatch |
| `DeliveryBatchDispatched`| Driver departs with batch | `batchId`, `driverId`, `dispatchedAt` | Live Tracking, Dispatch Console |

---

## 8. Kitchen Display System (KDS) Events

| Event Name | Trigger / Originating Command | Payload Summary | Primary Consumers |
| :--- | :--- | :--- | :--- |
| `KDSTicketCreated` | Order confirmed and routed to stations | `ticketId`, `orderId`, `stationId`, `items`, `priority`| KDS Station Screens |
| `KDSTicketStarted` | Cook taps Start | `ticketId`, `stationId`, `startedAt`, `cookId` | KDS Station Rail, Kitchen Workload Monitor |
| `KDSTicketReady` | Cook marks ticket complete | `ticketId`, `stationId`, `readyAt`, `allStationsReady` | Expo Screen, Order Domain (`OrderReady`) |
| `KDSTicketBumped` | Expo clears ticket from rail | `ticketId`, `bumpedAt`, `bumpedBy` | KDS Archival, Analytics |
| `KDSTicketRecalled` | Expo recalls bumped ticket | `ticketId`, `recalledAt`, `recalledBy` | Active KDS Station Rail |
