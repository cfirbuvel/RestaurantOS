# RestaurantOS — DEVELOPMENT UPDATE
# Driver Queue + Self Assignment + Reassignment

## מטרת העדכון

יש להרחיב את מערכת Delivery Management הקיימת כדי לתמוך ב:

1. Driver Availability Queue
2. FIFO Driver Assignment
3. Driver Self-Assignment
4. Driver Delivery Release / Reassignment
5. Driver Break / Return-to-Queue
6. Batch Self-Assignment
7. Manager Queue Override
8. Assignment Permissions
9. Real-time synchronization
10. Atomic assignment / concurrency protection
11. Audit trail
12. הכנה ל-Future Delivery Intelligence

הפיצ'רים חייבים להשתלב בארכיטקטורה הקיימת.

אין ליצור מערכת מקבילה או לעקוף את Delivery Domain הקיים.

---

# PROMPT A — DOMAIN MODEL & DATABASE

## Role

אתה Senior Backend Architect + Database Engineer.

לפני שינוי כלשהו:

1. בדוק את מבנה הפרויקט.
2. זהה את מודל Order.
3. זהה את Delivery model.
4. זהה Driver model.
5. זהה Assignment logic.
6. זהה Status enums.
7. זהה Audit/Event infrastructure.
8. זהה הרשאות קיימות.
9. זהה מנגנון Realtime.
10. אל תשנה מודלים קיימים ללא צורך.

---

# 1. Driver Multidimensional State Model (PHASE 00 Section 6)

אל תדחוס מושגים שאינם קשורים ל-enum ענק אחד. הפרד את הממדים הבאים:

### Shift Status:
- `OFF_SHIFT`
- `ON_SHIFT`
- `BREAK`

### Assignment Status:
- `AVAILABLE`
- `ASSIGNED`

### Trip Status:
- `NOT_STARTED`
- `IN_TRANSIT`
- `AT_CUSTOMER`
- `RETURNING`

אין ליצור duplicate status systems.

---

# 2. Driver Queue

יש ליצור Domain concept:

`DriverAvailabilityQueue`

המערכת צריכה לדעת:

- מתי הנהג הפך לפנוי
- האם הוא נמצא בתור
- מיקום נוכחי בתור
- האם הוא זכאי לקבל משלוח
- האם הוא מוחרג זמנית
- מתי נכנס לתור
- מתי יצא מהתור
- מדוע יצא

חשוב:

**אין לשמור Position בלבד כמקור האמת.**

המקור צריך להיות timestamp/orderable availability state שממנו ניתן לחשב את סדר התור.

לדוגמה:

```text
available_since
queue_eligible
```

Position יכול להיות derived data.

---

# 3. Queue Ordering

ברירת המחדל:

```text
FIFO
```

כלומר:

הנהג שהיה AVAILABLE במשך הזמן הארוך ביותר יקבל עדיפות.

Tie breaker:

```text
available_since
+
stable driver id
```

כדי למנוע תוצאה לא דטרמיניסטית.

---

# 4. Driver Assignment Permissions

יש לתמוך בהרשאות:

```text
can_self_assign_delivery
can_self_assign_batch
can_release_delivery
can_accept_without_manager
can_participate_in_driver_queue
```

אין להסתמך על Frontend permissions בלבד.

כל permission חייב להיבדק Server Side.

---

# 5. Restaurant Assignment Policy

לכל מסעדה/סניף ניתן להגדיר:

```text
assignment_mode
```

ערכים:

```text
FIFO
FIFO_WITH_AREA
SMART_RECOMMENDATION
MANAGER_ONLY
```

בנוסף:

```text
self_assignment_enabled
batch_self_assignment_enabled
driver_release_enabled
driver_release_requires_manager
automatic_queue_entry_enabled
```

יש לתמוך בירושה:

Organization
→ Restaurant
→ Branch

בהתאם לארכיטקטורה הקיימת.

---

# 6. Delivery Assignment History

אין לשנות רק:

`delivery.driver_id`

ולאבד היסטוריה.

יש ליצור/להשתמש ב:

`DeliveryAssignmentHistory`

כל שינוי צריך לשמור:

```text
delivery_id
previous_driver_id
new_driver_id
actor_type
actor_id
reason
created_at
metadata
```

Actor types:

```text
MANAGER
DRIVER_SELF_ASSIGN
SYSTEM
DRIVER_RELEASE
MANAGER_OVERRIDE
```

---

# 7. Concurrency

זהו requirement קריטי.

כאשר שני נהגים מנסים לקחת את אותו משלוח:

```text
Driver A → Self Assign
Driver B → Self Assign
```

אסור ששניהם יצליחו.

יש להשתמש ב:

- database transaction
- row-level locking / equivalent
- atomic conditional update
- unique constraints where appropriate

התוצאה חייבת להיות:

```text
Driver A → SUCCESS
Driver B → DELIVERY_ALREADY_ASSIGNED
```

לעולם לא:

```text
Driver A → SUCCESS
Driver B → SUCCESS
```

---

# 8. Delivery State Machine

יש לוודא שהמערכת אינה מאפשרת מעבר לא חוקי.

לדוגמה:

```text
READY
 ↓
AVAILABLE_FOR_ASSIGNMENT
 ↓
ASSIGNED
 ↓
PICKED_UP
 ↓
OUT_FOR_DELIVERY
 ↓
DELIVERED
```

Release לפני Pickup:

```text
ASSIGNED
 ↓
RELEASED
 ↓
AVAILABLE_FOR_ASSIGNMENT
```

לאחר Pickup:

שחרור רגיל צריך להיות מוגבל/דורש הרשאה או אישור מנהל בהתאם למדיניות.

---

# 9. Events

הוסף Events:

```text
DriverBecameAvailable
DriverEnteredQueue
DriverLeftQueue
DriverWentOnBreak
DriverReturnedFromBreak

DeliveryBecameAssignable
DeliveryAssigned
DeliverySelfAssigned
DeliveryReleased
DeliveryReassigned

DriverQueueReordered
DriverAssignmentOverridden
```

כל Event צריך להיות:

- typed
- immutable
- traceable
- tenant scoped
- branch scoped

---

# 10. Audit

כל שינוי תפעולי חייב להיות Audit-able.

דוגמה:

```text
20:28:14
Driver #17 released Delivery #123

actor:
DRIVER

reason:
CANNOT_PERFORM_DELIVERY
```

---

# PROMPT B — BACKEND / DELIVERY ASSIGNMENT ENGINE

## Role

אתה Senior Backend Engineer.

בנה את ה-Driver Assignment Engine מעל Domain Model קיים.

---

# 1. Get Available Drivers

API:

```text
GET /deliveries/drivers/available
```

התגובה צריכה לכלול:

```text
driver
status
available_since
queue_position
permissions
active_delivery_count
```

אין להסתמך על Position שהגיע מה-client.

---

# 2. Get Next Driver

Endpoint/service:

```text
getNextEligibleDriver(delivery)
```

ב-Gen 1:

FIFO הוא ברירת המחדל.

בעתיד ניתן להחליף את Strategy בלי לשנות את כל המערכת.

השתמש ב-Strategy Pattern:

```text
AssignmentStrategy

├── FIFOAssignmentStrategy
├── FIFOAreaAssignmentStrategy
├── SmartRecommendationStrategy
└── FutureAgentAssignmentStrategy
```

---

# 3. Self Assignment

Endpoint לדוגמה:

```text
POST /deliveries/:id/self-assign
```

Server צריך:

1. authenticate driver
2. verify tenant
3. verify branch
4. verify driver is on shift
5. verify permission
6. verify delivery is assignable
7. verify delivery has not been assigned
8. execute atomic assignment
9. remove driver from available queue if required
10. create history
11. emit event
12. notify clients
13. return updated delivery

---

# 4. Driver Release

Endpoint:

```text
POST /deliveries/:id/release
```

Validation:

- driver owns delivery
- delivery is releasable
- permission exists
- delivery has not been delivered
- policy permits release

After successful release:

```text
delivery → AVAILABLE_FOR_ASSIGNMENT
driver → AVAILABLE
```

unless business rules specify otherwise.

---

# 5. Automatic Queue Entry

When:

```text
delivery delivered
```

and driver confirms return to restaurant:

```text
driver → AVAILABLE
```

and:

```text
DriverEnteredQueue
```

is emitted.

The queue timestamp must be generated server-side.

Never trust:

```text
available_since
```

from client.

---

# 6. Break

When driver starts break:

```text
AVAILABLE → BREAK
```

Driver must be removed from eligible assignment queue.

When returning:

```text
BREAK → AVAILABLE
```

and by default:

```text
available_since = now()
```

therefore driver joins the end of FIFO queue.

---

# 7. Queue Override

Manager can reorder or override assignment.

Do not permanently mutate historical availability timestamps merely to fake queue order.

Instead create an explicit:

`QueueOverride`

or equivalent domain concept.

Store:

```text
branch
driver
previous_position
new_position
reason
actor
timestamp
```

---

# 8. Batch Assignment

If:

```text
can_self_assign_batch = true
```

driver may self-assign multiple compatible deliveries.

All deliveries must be validated atomically.

If one fails, define deterministic behavior:

- all-or-nothing
or
- partial assignment with explicit response

Prefer all-or-nothing for a single "assign batch" action unless existing architecture dictates otherwise.

---

# PROMPT C — REALTIME / FRONTEND INTEGRATION

## Role

אתה Senior Full Stack Engineer.

Connect the backend assignment engine to:

- Dispatch Center
- Driver Mobile
- Dashboard
- KDS where relevant

---

# 1. Realtime Events

When a driver becomes available:

Dispatch updates immediately.

When a driver self-assigns:

All relevant clients update immediately.

When a delivery is released:

The delivery immediately becomes available.

When another driver takes it:

Other drivers must see:

`המשלוח כבר שובץ לנהג אחר`

---

# 2. Optimistic UI

ניתן להשתמש ב-optimistic UI רק עבור visual feedback.

Never assume assignment succeeded.

Example:

```text
לחיצה:
צוות אליי

UI:
משבץ...

Server:
SUCCESS

UI:
✓ המשלוח שובץ אליך
```

or:

```text
Server:
CONFLICT

UI:
המשלוח כבר שובץ לנהג אחר.
```

---

# 3. Queue

Driver screen:

```text
AVAILABLE
↓
Queue Position
↓
Next Delivery
```

Dispatch:

```text
Available Drivers
↓
FIFO
↓
Next Driver
```

Both views must derive from the same backend state.

אין ליצור Queue state נפרד ב-Frontend.

---

# 4. Offline

אם הנהג Offline:

אין לאפשר Self Assignment מדומה.

יש להציג:

`אין חיבור — לא ניתן לצוות משלוח כרגע`

או, אם המערכת תומכת ב-command queue בעתיד, להשתמש ב-idempotent command architecture.

---

# PROMPT D — TESTING / QA

## Role

אתה Senior QA Automation Engineer.

יש לכתוב tests לכל הזרימות החדשות.

---

# UNIT TESTS

בדוק:

- FIFO ordering
- available_since
- break removal
- return from break
- queue eligibility
- permission checks
- release validation
- assignment strategy
- batch validation
- invalid status transitions

---

# INTEGRATION TESTS

בדוק:

### Scenario 1

דני חוזר ראשון.

יוסי חוזר שני.

אבי חוזר שלישי.

Expected:

```text
דני #1
יוסי #2
אבי #3
```

### Scenario 2

דני חוזר.

משלוח מוכן.

Expected:

דני מקבל עדיפות.

### Scenario 3

דני אינו יכול לבצע משלוח.

הוא משחרר אותו.

Expected:

```text
Delivery → available
Driver → available
```

### Scenario 4

יוסי self-assigns.

Expected:

```text
Delivery → assigned to Yossi
```

### Scenario 5

דני ויוסי לוחצים בו-זמנית.

Expected:

רק אחד מצליח.

### Scenario 6

נהג ללא permission מנסה self-assign.

Expected:

```text
403 / appropriate domain authorization error
```

### Scenario 7

נהג לוקח משלוח ואז יוצא להפסקה.

Expected:

המערכת אינה מכניסה אותו לתור AVAILABLE.

### Scenario 8

נהג מסיים משלוח וחוזר למסעדה.

Expected:

```text
AVAILABLE
queue_position = appropriate position
```

### Scenario 9

נהג חוזר מהפסקה.

Expected:

נכנס בסוף FIFO.

### Scenario 10

מנהל משנה Queue.

Expected:

השינוי מתועד ב-Audit.

---

# CONCURRENCY TEST

זהו Test חובה.

הרץ מספר requests במקביל:

```text
POST /deliveries/123/self-assign
```

ממספר drivers.

Expected:

```text
exactly ONE successful assignment
all others receive deterministic conflict
```

---

# E2E TEST

בנה Flow מלא:

```text
Order Created
↓
Kitchen Preparation
↓
Order Ready
↓
Driver #1 Available
↓
Driver #1 Assigned
↓
Driver #1 Cannot Perform
↓
Release
↓
Driver #2 Available
↓
Driver #2 Self Assigns
↓
Pickup
↓
Out for Delivery
↓
Delivered
↓
Driver Returns
↓
Driver #2 Available
↓
Driver Queue
```

---

# SECURITY TESTS

בדוק:

- Driver cannot assign another driver's delivery
- Driver cannot access another branch
- Driver cannot bypass permission
- Driver cannot modify queue
- Driver cannot assign delivered order
- Driver cannot release another driver's delivery
- Tenant isolation
- Branch isolation
- Audit integrity
- IDOR protection
- replay protection where relevant

---

# PERFORMANCE TESTS

בדוק:

- 50 drivers
- 500 available deliveries
- multiple concurrent assignments
- realtime updates during rush hour

אין ליצור N+1 queries בעת חישוב Queue.

---

# PROMPT E — DOCUMENTATION / ARCHITECTURE

יש לעדכן:

```text
ARCHITECTURE.md
DOMAIN_MODEL.md
DELIVERY.md
API.md
RBAC.md
EVENTS.md
AUDIT_LOG.md
TESTING.md
```

תיעוד חייב להסביר:

1. Driver Queue
2. FIFO
3. Self Assignment
4. Release
5. Reassignment
6. Permissions
7. Concurrency
8. Events
9. Audit
10. Future Smart Assignment

---

# FUTURE AI COMPATIBILITY

אין להכניס LLM או Agent למנגנון Gen 1.

במקום זאת יש להגדיר Interface:

```text
AssignmentStrategy
```

כך שבעתיד:

```text
FIFO
        ↓
Smart Recommendation
        ↓
AI Copilot
        ↓
Agentic Assignment
```

יכול להיכנס ללא Rewrite של Delivery Domain.

---

# IMPORTANT ARCHITECTURAL RULE

אסור ליצור:

```text
Driver Queue Service
Self Assignment Service
Smart Delivery Service
```

שכל אחד מנהל מצב משלו.

כולם חייבים לעבוד מול:

**Single Delivery Assignment Domain**

עם מקור אמת יחיד.

---

# DEFINITION OF DONE

הפיצ'ר אינו Complete עד שכל הבאים מתקיימים:

[ ] DB migration  
[ ] Domain model  
[ ] API  
[ ] RBAC  
[ ] FIFO queue  
[ ] Self assignment  
[ ] Release  
[ ] Reassignment  
[ ] Break handling  
[ ] Return-to-queue  
[ ] Batch assignment  
[ ] Manager override  
[ ] Realtime  
[ ] Atomic concurrency protection  
[ ] Audit log  
[ ] Unit tests  
[ ] Integration tests  
[ ] E2E tests  
[ ] Security tests  
[ ] Performance tests  
[ ] Documentation  
[ ] Mobile UI integration  
[ ] Desktop/Dispatch integration  
[ ] Offline states  
[ ] Error states  
[ ] Production logging/observability

---

# FINAL BUSINESS RULE

ברירת המחדל של RestaurantOS:

> **השליח שהתפנה ראשון יקבל עדיפות למשלוח הבא שמוכן.**

אבל:

> **המדיניות ניתנת להגדרה על ידי מנהל המסעדה.**

ובמקרה של Driver Self Assignment:

> **נהג מורשה יכול לקחת משלוח זמין בעצמו, ללא צורך בהתערבות מנהל.**

ובמקרה של ביטול/שחרור:

> **משלוח ששוחרר חוזר למאגר המשלוחים הזמינים ויכול להילקח על ידי נהג מורשה אחר.**

כל הפעולות מתועדות, מסונכרנות בזמן אמת, מוגנות מפני Race Conditions ומוכנות לשכבת Delivery Intelligence העתידית.