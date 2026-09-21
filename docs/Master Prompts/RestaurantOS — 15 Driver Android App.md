# RestaurantOS — Prompt 15

## Driver Android Application

Continue from the existing RestaurantOS implementation.

This is NOT a new system.

Do not rebuild delivery logic.
Do not rebuild driver logic.
Do not move business rules into the mobile application.
Do not modify completed backend behavior unless a real API/contract gap is discovered.

The backend already contains driver and delivery functionality.

This phase creates the native Android Driver Client.

---

# 1. Audit Existing Driver Backend

Inspect:

* driver authentication
* driver profile
* shift
* clock-in
* clock-out
* break
* return from break
* availability
* FIFO queue
* self-assignment
* release
* delivery assignment
* start delivery
* pickup
* arrival
* completion
* vehicle
* tracker
* realtime
* notifications

Create:

`docs/DRIVER_APP_AUDIT.md`

Document all existing endpoints before creating new ones.

---

# 2. Technology

Use the same mobile technology selected for Manager App.

Do not create two unrelated Android architectures.

Preferred:

Flutter if no stronger existing decision exists.

The application must be Android-first and future iOS-compatible.

---

# 3. Driver Application Flow

Primary navigation:

```text
Login
  |
Driver Home
  |
+-----------------------------+
| Shift                       |
| Availability                |
| Current Delivery            |
| Next Delivery               |
| Notifications               |
+-----------------------------+
```

---

# 4. Authentication

Driver login.

Persist secure session.

Support:

* logout
* expired session
* reconnect
* unauthorized response
* device/session invalidation

Do not store sensitive credentials insecurely.

---

# 5. Shift

Driver can:

* clock in
* clock out
* start break
* return from break

Show current state clearly.

Prevent impossible transitions in UI, but backend remains authoritative.

---

# 6. Availability

Display:

* AVAILABLE
* ASSIGNED
* BREAK
* OFF_SHIFT

When returning to the restaurant:

the backend FIFO availability queue remains authoritative.

The app must not calculate its own queue position.

---

# 7. Delivery Queue

Display eligible deliveries.

Driver can self-assign only when backend permits.

Use the existing atomic/race-safe self-assignment endpoint.

Handle:

* success
* already assigned
* 409 conflict
* expired eligibility
* network failure

Never assume an assignment succeeded without server confirmation.

---

# 8. Current Delivery

Display:

* order number
* customer
* phone
* delivery address
* building information
* access code if authorized
* order summary
* notes
* payment state
* delivery instructions

Privacy:

Only show data required for the current operational task.

---

# 9. Navigation

Provide a navigation action.

Do not make the RestaurantOS app responsible for turn-by-turn navigation unless explicitly required.

Use an external navigation provider where appropriate.

The app should:

* open destination
* return to RestaurantOS
* preserve delivery state

---

# 10. Delivery Lifecycle

Implement the existing domain lifecycle:

```text
ASSIGNED
   |
STARTED
   |
PICKED_UP
   |
IN_TRANSIT
   |
AT_CUSTOMER
   |
COMPLETED
   |
RETURNING
   |
AVAILABLE
```

Use the actual backend contract if names differ.

Do not invent parallel states.

---

# 11. Arrival

Fleet GPS/tracker data may indicate that a driver entered the customer area.

However:

GPS is NOT authoritative proof of delivery completion.

The driver remains responsible for completing the operational action.

If the backend exposes arrival confirmation, use it.

---

# 12. Delivery Completion

Support the existing completion workflow.

Prepare the architecture for future:

* OTP
* photo proof
* signature
* customer confirmation

Do not implement unsupported features merely as fake UI.

---

# 13. Notifications

Push notifications for:

* new assignment
* changed assignment
* manager message
* urgent delivery
* operational alerts

Notification actions must deep-link into the correct delivery.

---

# 14. Background Behavior

Implement carefully.

Potential background capabilities:

* push notification reception
* limited location updates where legally/technically permitted
* delivery state synchronization
* reconnect

Do not continuously track location outside the configured operational policy.

Respect:

* shift scope
* permissions
* privacy
* battery

---

# 15. Offline

The driver application must remain usable during short connectivity interruptions.

Cache:

* current delivery
* essential address/instructions
* last known operational state

For state-changing actions:

* use idempotency where supported
* never blindly duplicate commands
* reconcile with server
* clearly indicate pending/synced state

---

# 16. UX

Driver UX priorities:

1. Speed
2. Clarity
3. Safety
4. Reliability
5. Minimal interaction

Avoid complex dashboards.

A driver should be able to understand the current task in seconds.

Large buttons.

Minimal text entry.

Hebrew RTL with English support.

---

# 17. Security

Protect:

* customer phone numbers
* addresses
* access codes
* order data
* authentication tokens
* location data

Do not log sensitive customer information.

---

# 18. Testing

Automated:

* login
* shift transitions
* delivery loading
* self-assignment
* 409 conflict
* start
* pickup
* arrival
* completion
* release
* realtime update
* notification deep-link

Offline tests:

* disconnect during assignment
* disconnect during delivery
* reconnect
* duplicate command
* expired session

Manual:

* Android permissions
* GPS
* background behavior
* push
* poor cellular connection
* screen lock/unlock
* app restart during delivery

---

# 19. Documentation

Create:

`docs/DRIVER_APP.md`

Document:

* architecture
* lifecycle
* API
* realtime
* GPS
* notifications
* offline
* security
* build/install
* testing

Update implementation status.

---

# Definition of Done

A real Android Driver MVP exists.

A driver can:

1. authenticate
2. start/end shift
3. take break
4. become available
5. receive/self-assign delivery
6. see delivery details
7. navigate
8. update delivery state
9. complete delivery
10. return to restaurant
11. become available again
12. receive realtime updates
13. survive temporary connectivity loss

No delivery business logic is duplicated in the app.
