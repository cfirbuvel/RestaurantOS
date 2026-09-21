# RestaurantOS — Prompt 17

## Unified Notifications, Push Delivery and Deep Linking

Continue from the existing RestaurantOS system.

Do not create a second notification architecture if one already exists.

Audit the existing notification/event infrastructure first.

---

# 1. Clients

Support:

* Web
* Manager Android
* Driver Android
* KDS where appropriate

---

# 2. Notification Types

Define typed notification events for:

* new delivery assignment
* delivery reassignment
* delivery overdue
* no available driver
* KDS SLA breach
* order issue
* payment issue
* integration failure
* system alert
* manager message

Do not send notifications for every low-level event.

Notifications must represent actionable events.

---

# 3. Notification Payload

Every notification should contain:

* notification ID
* tenant
* branch
* recipient
* type
* priority
* timestamp
* title
* body
* target entity
* deep-link target
* read state

Avoid sensitive data in push payloads.

---

# 4. Deep Links

Examples:

```text
restaurantos://delivery/{id}
restaurantos://order/{id}
restaurantos://kds/ticket/{id}
restaurantos://driver/{id}
restaurantos://alert/{id}
```

Implement equivalent routing for Web.

---

# 5. Reliability

Support:

* duplicate notifications
* delayed push
* expired notification
* revoked permissions
* offline client
* app not running

Push is not the source of truth.

When opened, the client must retrieve current server state.

---

# 6. Testing

Test:

* push generation
* authorization
* tenant isolation
* branch isolation
* deep linking
* duplicate push
* stale notification
* revoked permission

Document the architecture.

Update:

`docs/NOTIFICATIONS.md`
