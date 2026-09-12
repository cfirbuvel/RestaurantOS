# RestaurantOS — Design System Specification
**Origin:** Stitch Project `projects/37093578543690591`  
**Theme:** Restaurant Operational Matrix  
**Status:** Canonical Design Contract  

---

## 1. Brand & Style Philosophy

This design system drives high-velocity hospitality operations spanning Point of Sale (POS), Kitchen Display Systems (KDS), guest-facing self-ordering kiosks, dynamic delivery dispatch, and multi-location inventory logistics. The visual tone is utilitarian, tactile, and authoritative. Rather than leaning on delicate decorative embellishments or ephemeral AI-inspired aesthetics, it is grounded in high-contrast industrial ergonomics, zero-ambiguity status signposting, and high tactile confidence under noisy, wet, or chaotic restaurant conditions.

### Core Principles
1. **Frictionless Legibility under Velocity:** Operational data must be readable at an arm's distance on kitchen bump screens, delivery dispatch walls, and mobile handheld terminals under harsh ambient lighting.
2. **RTL-Native Priority:** Complete native Right-to-Left (RTL) structural mechanics for Hebrew (`dir="rtl"`). Information hierarchy, contextual badges, navigation flows, and physical gestural paradigms map intrinsically to natural right-to-left optical reading patterns.
3. **Tri-Factor Status Certainty:** Operational state cannot rely on color alone. Every ticket, modifier, alert, and delivery parcel employs color tint, explicit iconography, and unmistakable Hebrew terminology simultaneously to eradicate cross-contamination of statuses.
4. **Tactile Touch Targets:** All touch targets maintain an operational threshold (minimum 44px on phone, 52px on POS, 64px on KDS bump bars) with crisp haptic bounds, avoiding mis-taps during peak rush hours.

---

## 2. Design Tokens & Palette

### Operational Colors
| Token | Hex | Role / Context |
| :--- | :--- | :--- |
| `primary` | `#0F172A` | Deep Slate base for core structural framing, high-emphasis text, prominent headers |
| `primary-container` | `#131B2E` | Elevated dark container for cards, toolbars, and high-emphasis surfaces |
| `secondary` | `#0051D5` / `#2563EB` | Interactive Blue for selection states, standard links, active navigation tabs |
| `secondary-container` | `#316BF3` | Active state accent container |
| `surface` | `#F8F9FF` | Primary light canvas background |
| `surface-container-lowest` | `#FFFFFF` | Ticket cards, modal surfaces, inputs |
| `surface-container-low` | `#EFF4FF` | Soft tinted card backgrounds and table alternating rows |
| `surface-container` | `#E5EEFF` | Structural dividers, secondary button backgrounds |
| `surface-container-high` | `#DCE9FF` | Subtle border and card outline highlights |
| `surface-container-highest`| `#D3E4FE` | Active filter chips, high contrast borders |
| `on-surface` | `#0B1C30` | High-contrast dark typography on light backgrounds |
| `on-surface-variant` | `#45464D` | Secondary metadata text, timestamps, subtitles |
| `outline` | `#76777D` | Default element border and form field outlines |
| `outline-variant` | `#C6C6CD` | Subtle divider lines and disabled borders |

### Functional Status Tokens (Tri-Factor)
| State (Hebrew) | Background (10%) | Border (100%) | Text / Icon | Icon | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **חדשה (New)** | `#EFF6FF` | `#3B82F6` | `#1D4ED8` | `sparkles` | Order just placed, awaiting kitchen acceptance |
| **אושרה (Approved)** | `#EEF2FF` | `#6366F1` | `#4338CA` | `check` | Order confirmed by cashier / system |
| **בהכנה (In Prep)** | `#FFFBEB` | `#F59E0B` | `#B45309` | `flame` | Ticket active on KDS kitchen station |
| **מוכנה (Ready)** | `#ECFDF5` | `#10B981` | `#047857` | `bell-ring` | Ready on pass / pickup shelf |
| **במשלוח (Delivery)** | `#F0F9FF` | `#0284C7` | `#0369A1` | `bike` | Assigned to driver and in transit |
| **נמסרה (Fulfilled)** | `#F1F5F9` | `#94A3B8` | `#334155` | `check-circle-2` | Handed to customer / completed |
| **בוטלה (Cancelled)** | `#FEF2F2` | `#EF4444` | `#B91C1C` | `alert-octagon` | Voided / refunded order |

### KDS Bump Station Tokens
- **ממתינה (Queued):** Neutral Slate (`#F8FAFC`), Border (`#CBD5E1`), Icon `clock`
- **בהכנה (Cooking):** High-visibility Amber (`#FFF7ED`), Border (`#EA580C`), Pulsing border animation
- **מוכנה (Plate Up):** Emerald Green (`#F0FDF4`), Border (`#16A34A`), Icon `chef-hat`

---

## 3. Typography: Rubik (Hebrew-First)

Rubik is selected for its robust geometric construction, native Hebrew character balance, and legibility at speed. Dalet (ד) vs Resh (ר), and Bet (ב) vs Kaf (כ) maintain sharp visual distinction.

| Scale Token | Size / Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- |
| `display-kds` | 44px / 52px | 800 (Extra Bold) | KDS station headers, urgent queue counters |
| `headline-lg` | 32px / 40px | 700 (Bold) | Desktop backoffice screen titles |
| `headline-lg-mobile` | 24px / 32px | 700 (Bold) | Mobile & tablet screen headers |
| `headline-md` | 22px / 28px | 600 (Semi Bold) | Ticket headers, table numbers (`#1042 - שולחן 14`) |
| `headline-sm` | 18px / 24px | 600 (Semi Bold) | Section titles, modal headers |
| `body-lg` | 16px / 24px | 400 (Regular) | Primary inputs, customer addresses, notes |
| `body-lg-bold` | 16px / 24px | 600 (Semi Bold) | Order item names (`2x פיצה מרגריטה`) |
| `body-md` | 14px / 20px | 400 (Regular) | Item modifiers, descriptions |
| `body-md-bold` | 14px / 20px | 600 (Semi Bold) | Subtotals, table headers |
| `label-caps` | 12px / 16px | 700 (Bold) | Badges, category labels, operational pills |
| `label-sm` | 11px / 14px | 500 (Medium) | Timestamps, micro-metadata |
| `numeric-timer` | 20px / 24px | 700 (Bold, Tabular) | KDS countdown timers (`+14:22`, `08:45`) |

### RTL & Bidirectional Formatting
- `dir="rtl"` strictly applied on root HTML container.
- All numbers, prices (`₪`), and order IDs (`#`) use `font-variant-numeric: tabular-nums` and `unicode-bidi: isolate` to avoid glyph inversion.

---

## 4. Spacing & Ergonomic Touch Targets

```css
--space-2xs: 2px;
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
--space-3xl: 64px;

/* Operational Touch Target Minimums */
--touch-min: 44px; /* Mobile hand-held terminal minimum */
--touch-pos: 52px; /* Cashier POS tap target */
--touch-kds: 64px; /* Kitchen bump bar tap button */
```

---

## 5. Shape & Corner Radii

- **Base Components (`rounded` - 4px):** Modifiers, status tags, form inputs, kitchen checklist items.
- **Cards & Panels (`rounded-lg` - 8px):** KDS tickets, order cards, inventory containers, modal dialogs.
- **Bottom Drawers & Modals (`rounded-xl` - 12px):** Top corners of mobile sheets and slide-in panels.
- **Action Pills (`rounded-full`):** Reserved exclusively for counter badges (`[ 3 ]`) and status dots.

---

## 6. Stitch Screen Catalog

| Screen ID | Device Type | Name / Purpose |
| :--- | :--- | :--- |
| `09968689b1e14306844913a43a3148be` | Mobile (390x1381) | ניהול הזמנות תפעולי מובייל (Mobile Operational Orders) |
| `0b391132334c41d08ba2d97c4ce8bf66` | Tablet (1280x960) | מסך טאבלט דו-עמודי מטבח וסנכרון רשת (Two-Column Tablet KDS & Sync) |
| `7174da956ebf46d991bd028da082fa29` | Mobile (390x1355) | מסך בית ותמונת מצב מובייל (Mobile Home Dashboard & Operational Snapshot) |
| `83777e267e9746fbb364bb2261083c65` | Mobile (390x1282) | ניהול משלוחים ושליחים מובייל (Mobile Delivery & Driver Dispatch) |
| `b8b05a02eeec4938b33955e69e2ec345` | Mobile (390x1057) | אישור ציוות משלוחים ועקיפת מנהל (Assignment Approval & Manager Override) |
| `ddb856f3f22d4ca6a49bf27d464a917d` | Mobile (390x1358) | דיווח כשל במשלוח ואופליין (Driver Delivery Failure & Offline Sync) |
| `f288edb62d59493291d869a48f5c69f8` | Mobile (390x884) | מסך ראשי ומשלוח משולב (Driver Main & Combined Route View) |
| `fd770d3ee720412f81be66d6b94187f1` | Landscape (1280x873)| מערכת מטבח ובונים דיגיטליים (KDS Kitchen Display & Bump Bar) |
| `cab43632eae34cfdb95ba44dcf4e4122` | Desktop (1280x3189)| ניהול מערכת ובקרה מורחב (Desktop Backoffice & Fleet Oversight) |
