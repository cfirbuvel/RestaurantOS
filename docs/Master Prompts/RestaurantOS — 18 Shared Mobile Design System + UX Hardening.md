# RestaurantOS — Prompt 18

## Shared Mobile Design System and UX Hardening

Continue from the existing Manager and Driver applications.

Do not redesign the entire RestaurantOS.

Do not change established web UI unnecessarily.

The goal is consistency and usability across native mobile clients.

---

# 1. Shared Design Tokens

Define reusable:

* typography
* spacing
* radius
* elevation
* status colors
* icons
* button sizes
* input styles
* cards
* alerts
* navigation
* loading states
* error states

---

# 2. RestaurantOS Status Semantics

Standardize visual representation of:

* success
* warning
* error
* pending
* active
* unavailable
* offline

Status must not rely on color alone.

---

# 3. RTL

Hebrew is first-class.

Test:

* Hebrew
* English
* mixed text
* phone numbers
* addresses
* numbers
* timestamps
* order IDs

---

# 4. Operational UX

Prioritize:

Clarity > Decoration

Speed > Animation

Reliability > Visual Complexity

This principle applies especially to Driver and Manager apps.

---

# 5. Loading

Never show blank screens.

Use:

* skeletons
* progress
* meaningful loading indicators

---

# 6. Errors

Errors must explain:

What happened.

What the user can do.

Example:

```text
לא ניתן להקצות את המשלוח.

המשלוח כבר הוקצה לנהג אחר.

[רענן]
```

Do not expose technical stack traces.

---

# 7. Accessibility

Check:

* touch target
* font scaling
* contrast
* screen reader semantics
* keyboard where applicable

---

# 8. Testing

Create a mobile UX checklist and perform manual validation across representative Android screen sizes.

Document findings and fixes.
