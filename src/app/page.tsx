"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Server,
  Database,
  Lock,
  Radio,
  ChefHat,
  Bike,
  Package,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  MapPin,
  TrendingUp,
  Boxes,
  Truck,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Navigation,
  Eye,
  Check,
  X,
  Sliders,
  Megaphone,
  Gift,
  Tag,
  Percent,
  Award,
  Star,
  Users,
  Send,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  UserCheck,
  Plug,
  Webhook,
  CreditCard,
  FileText,
  RotateCcw,
  Inbox,
  Activity,
  Zap,
  ShoppingBag,
  ChevronLeft,
  Globe,
  Smartphone,
  Monitor,
} from "lucide-react";
import { StatusBadge, OrderStatus } from "@/components/ui/status-badge";

type ActiveTab = "overview" | "orders" | "kds" | "delivery" | "inventory" | "marketing" | "telephony" | "integrations" | "storefront";

const PIPELINE_STEP_DETAILS: Record<number, { title: string; subtitle: string; icon: string; desc: string; detail: string; status: string }> = {
  1: {
    title: "קבלת Webhook גולמי (Raw Webhook Ingestion)",
    subtitle: "HTTP POST Buffer Reader",
    icon: "📥",
    desc: "קליטת גוף הבקשה כ-Buffer גולמי (Raw Bytes) לפני כל המרת JSON, כדי לשמור על דיוק הבתים הנדרש לחישוב חתימת HMAC.",
    detail: "המסלול מחלץ כותרות: x-wolt-signature, x-10bis-signature, x-webhook-timestamp ומגן מפני חבלות.",
    status: "200 OK Raw Ingestion",
  },
  2: {
    title: "אימות חתימה קריפטוגרפית (Cryptographic Signature Verification)",
    subtitle: "HMAC-SHA256 & Timing Safe",
    icon: "🔐",
    desc: "חישוב חתימת HMAC-SHA256 מול המפתח הסודי הייעודי של הספק והשוואה בעזרת crypto.timingSafeEqual למניעת Timing Attacks.",
    detail: "כל חוסר התאמה דוחה מיד את הבקשה עם 401 Unauthorized ונרשם ב-Audit Log המאובטח.",
    status: "Timing-Safe Equal Passed",
  },
  3: {
    title: "בדיקת רעננות חותמת זמן (Timestamp Freshness)",
    subtitle: "Replay Attack Prevention",
    icon: "⏱️",
    desc: "אימות שה-Timestamp של הבקשה נמצא בתוך חלון של 300 שניות (5 דקות) ביחס לשעון השרת.",
    detail: "בקשות עם חותמת ישנה מ-5 דקות או עתידית נדחות למניעת מתקפות Replay (שידור חוזר זדוני).",
    status: "±300s Sliding Window Valid",
  },
  4: {
    title: "בדיקת כפילויות ונעילה מבוזרת (Idempotency Key & Distributed Lock)",
    subtitle: "Redis SETNX 24h Lock",
    icon: "🔒",
    desc: "שליפת מפתח Idempotency ייחודי ונעילתו ב-Redis למשך 60 שניות, עם שמירת תוצאת הטיפול ל-24 שעות.",
    detail: "בקשות כפולות (Retry אוטומטי של הספק) מזוהות מיד ומחזירות 200 OK שמור ללא שכפול ההזמנה במטבח.",
    status: "Idempotent Safe / Zero Duplicates",
  },
  5: {
    title: "המרת מבנה ספק למבנה קנוני (Provider Payload Transformation)",
    subtitle: "Normalized Adapter Transform",
    icon: "🔄",
    desc: "המרת פורמט הספק החיצוני (Wolt, 10bis, Mishloha) לאובייקט הזמנה קנוני אחיד (Universal Order DTO).",
    detail: "המרת תוספות, מידות עשייה, שמות לקוחות, כתובות, וחישובי אגורות/שקלים בהתאמה מלאה.",
    status: "Zero Domain Leaks",
  },
  6: {
    title: "מיפוי פריטים וסניפים (Catalog & Branch Resolution)",
    subtitle: "Menu / SKU Resolver",
    icon: "📋",
    desc: "שיוך מזהי הפריטים והתוספות של הספק החיצוני לפריטי התפריט האמיתיים במסעדה (SKU Resolution).",
    detail: "במידה ופריט חדש ולא מוכר — נוצר פריט ייעודי עם סטטוס דורש אישור והתראה למנהל.",
    status: "Catalog Mapped 100%",
  },
  7: {
    title: "אימות סכמה קפדני (Zod Schema Validation)",
    subtitle: "Strict Contract Enforcement",
    icon: "✅",
    desc: "בדיקה מקיפה בעזרת Zod של כל השדות הקנוניים: סכומים, מספר לקוח, טלפון, ופריטים תקינים.",
    detail: "במידה ויש שגיאת ולידציה — ה-Payload מועבר ישירות ל-Dead-Letter Queue לצורך חקירה.",
    status: "Zod Schema Validated",
  },
  8: {
    title: "שמירה אטומית במסד הנתונים (Atomic DB Persistence)",
    subtitle: "Universal Orders Table",
    icon: "💾",
    desc: "שמירת ההזמנה, פריטיה, הכתובת והפרטים בטבלת orders תחת Tenant ID ו-Branch ID המבודדים.",
    detail: "עסקת טרנזקציה אטומית המבטיחה שלמות נתונים מלאה ומניעת חלקי נתונים יתומים.",
    status: "ACID Guaranteed",
  },
  9: {
    title: "רישום אירוע דומיין ב-Outbox (Transactional Outbox Event)",
    subtitle: "OrderCreated Event Ledger",
    icon: "📤",
    desc: "כתיבת אירוע OrderCreated לטבלת outbox_events באותה טרנזקציה, להבטחת At-Least-Once Delivery.",
    detail: "האירוע מפעיל אוטומטית ניפוק מלאי (BOM), שליחת כרטיס למטבח (KDS) והקצאת שליח.",
    status: "Outbox Ledger Committed",
  },
  10: {
    title: "עדכון Realtime וסנכרון מטבח (Realtime Broadcast & Invalidation)",
    subtitle: "Redis Pub/Sub & WebSockets",
    icon: "⚡",
    desc: "שידור האירוע לעמדות ה-KDS, קופות ה-POS ומסכי המנהלים בזמן אמת (פחות מ-100 מילי-שניות).",
    detail: "איפוס Cache של דוחות היום וסנכרון מיידי של המסכים ללא צורך בריענון דף.",
    status: "Instant Realtime Sync (WebSocket)",
  },
};

export default function OperationalDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  // Sample KDS tickets state for interactive demonstration
  const [tickets, setTickets] = useState([
    {
      id: "tkt-101",
      orderNumber: "ORD-1042",
      station: "burgers",
      stationName: "עמדת המבורגרים",
      items: ["2x המבורגר שורטק 220ג (M, צ'דר)", "1x דאבל בורגר (WD, ביצת עין)"],
      elapsedSeconds: 340,
      targetSeconds: 900,
      slaStatus: "ON_TIME",
      status: "IN_PREPARATION",
    },
    {
      id: "tkt-102",
      orderNumber: "ORD-1043",
      station: "sides",
      stationName: "עמדת צ'יפס ותוספות",
      items: ["2x צ'יפס בלגי פריך", "1x טבעות בצל"],
      elapsedSeconds: 780,
      targetSeconds: 900,
      slaStatus: "NEAR_SLA",
      status: "IN_PREPARATION",
    },
    {
      id: "tkt-103",
      orderNumber: "ORD-1040",
      station: "drinks",
      stationName: "אקספו ושתייה",
      items: ["2x קוקה קולה 330 מ\"ל", "1x פנטה"],
      elapsedSeconds: 980,
      targetSeconds: 600,
      slaStatus: "SLA_EXCEEDED",
      status: "QUEUED",
    },
  ]);

  // Sample Universal Orders state
  const [ordersList, setOrdersList] = useState([
    {
      id: "ORD-1042",
      channel: "PHONE",
      channelLabel: "טלפון (Phone)",
      channelBg: "bg-amber-50 text-amber-800 border-amber-200",
      customer: "דניאל גולדשטיין (052-4455667)",
      isVip: true,
      items: "2x המבורגר קלאסי + צ'יפס ענק",
      total: 138.00,
      status: "IN_PREPARATION" as OrderStatus,
    },
    {
      id: "ORD-1041",
      channel: "DELIVERY",
      channelLabel: "משלוח (Delivery)",
      channelBg: "bg-blue-50 text-blue-700 border-blue-200",
      customer: "עומר לוי (050-7776655)",
      isVip: false,
      items: "המבורגר שורטק (M) + צ'יפס בלגי",
      total: 87.00,
      status: "READY" as OrderStatus,
    },
    {
      id: "ORD-1040",
      channel: "DINE_IN",
      channelLabel: "ישיבה (Dine-In T-4)",
      channelBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      customer: "דני כהן (VIP)",
      isVip: true,
      items: "2x דאבל בורגר + 2x קולה",
      total: 168.00,
      status: "COMPLETED" as OrderStatus,
    },
    {
      id: "ORD-1039",
      channel: "TAKEAWAY",
      channelLabel: "איסוף (Takeaway)",
      channelBg: "bg-purple-50 text-purple-700 border-purple-200",
      customer: "מיכל אברהם",
      isVip: false,
      items: "המבורגר טבעוני + טבעות בצל",
      total: 64.00,
      status: "DELIVERED" as OrderStatus,
    },
  ]);

  // Sample Driver Queue state
  const [driverQueue, setDriverQueue] = useState([
    { position: 1, name: "דני כהן (Dan)", id: "usr-02-driver", status: "ON_SHIFT", assignment: "AVAILABLE", availableSince: "לפני 25 דקות", vehicle: "קטנוע Kymco 125" },
    { position: 2, name: "יוסי לוי (Yossi)", id: "usr-03-driver", status: "ON_SHIFT", assignment: "AVAILABLE", availableSince: "לפני 12 דקות", vehicle: "יונדאי i10" },
    { position: 3, name: "רונן אלון (Ronen)", id: "usr-04-driver", status: "BREAK", assignment: "UNAVAILABLE", availableSince: "בהפסקה", vehicle: "אופניים חשמליים" },
  ]);

  // Sample Batch Recommendation state
  const [batchActionStatus, setBatchActionStatus] = useState<string | null>(null);

  // Phase 6: Marketing, Loyalty & Coupons Interactive State
  const [loyaltyMember, setLoyaltyMember] = useState({
    id: "cust-01",
    name: "יוסי לוי (Yossi)",
    phone: "052-9876543",
    currentPoints: 650,
    lifetimePoints: 850,
  });

  const [couponCodeInput, setCouponCodeInput] = useState("SUMMER15");
  const [couponSubtotalInput, setCouponSubtotalInput] = useState(120);
  const [couponFeedback, setCouponFeedback] = useState<{
    valid: boolean;
    discount: number;
    message: string;
  } | null>(null);

  const [simProfile, setSimProfile] = useState({
    isFirstOrder: true,
    isVip: false,
    orderSubtotal: 110,
    channel: "WEB",
  });

  const [campaigns, setCampaigns] = useState([
    {
      id: "camp-01",
      name: "מבצע קיץ 2026 — 15% הנחה על בורגרים",
      type: "PROMOTIONAL",
      status: "ACTIVE",
      budgetSpent: 1250,
      budgetLimit: 5000,
      sentCount: 1240,
      conversions: 185,
      channels: ["SMS", "WHATSAPP"],
    },
    {
      id: "camp-02",
      name: "החזרת לקוחות VIP רדומים (Win-Back)",
      type: "WIN_BACK",
      status: "SCHEDULED",
      budgetSpent: 0,
      budgetLimit: 2500,
      sentCount: 84,
      conversions: 0,
      channels: ["WHATSAPP"],
    },
    {
      id: "camp-03",
      name: "הטבת הצטרפות ראשונה — 20% הנחה",
      type: "FIRST_ORDER",
      status: "ACTIVE",
      budgetSpent: 890,
      budgetLimit: 3000,
      sentCount: 420,
      conversions: 94,
      channels: ["SMS"],
    },
  ]);

  const [dispatchToast, setDispatchToast] = useState<string | null>(null);

  const handleEarnPoints = (pts: number) => {
    setLoyaltyMember((prev) => ({
      ...prev,
      currentPoints: prev.currentPoints + pts,
      lifetimePoints: prev.lifetimePoints + pts,
    }));
  };

  const handleRedeemPoints = (pts: number) => {
    if (loyaltyMember.currentPoints < pts) return;
    setLoyaltyMember((prev) => ({
      ...prev,
      currentPoints: prev.currentPoints - pts,
    }));
  };

  const handleValidateCoupon = () => {
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) {
      setCouponFeedback({ valid: false, discount: 0, message: "נא להזין קוד קופון" });
      return;
    }
    if (code === "SUMMER15") {
      if (couponSubtotalInput < 50) {
        setCouponFeedback({ valid: false, discount: 0, message: "הקופון דורש הזמנה בסך ₪50 לפחות" });
      } else {
        const disc = Math.min(couponSubtotalInput * 0.15, 30);
        setCouponFeedback({ valid: true, discount: disc, message: `קופון תקין! הוחלה הנחה של 15% (₪${disc.toFixed(2)})` });
      }
    } else if (code === "WELCOME20") {
      if (couponSubtotalInput < 60) {
        setCouponFeedback({ valid: false, discount: 0, message: "קופון לקוח חדש דורש הזמנה של ₪60 לפחות" });
      } else {
        const disc = Math.min(couponSubtotalInput * 0.20, 40);
        setCouponFeedback({ valid: true, discount: disc, message: `קופון תקין! הנחת לקוח חדש 20% (₪${disc.toFixed(2)})` });
      }
    } else if (code === "VIP50") {
      if (couponSubtotalInput < 150) {
        setCouponFeedback({ valid: false, discount: 0, message: "קופון VIP דורש מינימום הזמנה של ₪150" });
      } else {
        setCouponFeedback({ valid: true, discount: 50, message: "קופון VIP תקין! הוחלה הנחה בסך ₪50.00" });
      }
    } else {
      setCouponFeedback({ valid: false, discount: 0, message: "קוד קופון לא קיים או שפג תוקפו" });
    }
  };

  const handleDispatchCampaign = (campaignId: string) => {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? { ...c, status: "ACTIVE", sentCount: c.sentCount + 150, budgetSpent: c.budgetSpent + 75 }
          : c
      )
    );
    setDispatchToast(`הקמפיין שוגר בהצלחה ל-150 נמענים נוספים ברשת!`);
    setTimeout(() => setDispatchToast(null), 4000);
  };

  // Helper to compute loyalty tier (לקוח חדש, לקוח קבוע, לקוח VIP)
  const getTierInfo = (points: number) => {
    if (points >= 2000) {
      return { tier: "VIP", label: "לקוח VIP", color: "bg-purple-100 text-purple-800 border-purple-300", icon: "⭐" };
    }
    if (points >= 500) {
      return { tier: "REGULAR", label: "לקוח קבוע", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "🎖️" };
    }
    return { tier: "NEW_CUSTOMER", label: "לקוח חדש", color: "bg-blue-100 text-blue-800 border-blue-300", icon: "🌱" };
  };

  const bumpTicket = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: t.status === "READY" ? "COMPLETED" : "READY" } : t))
    );
  };

  // Phase 7: Telephony & Caller ID Popup Demo State
  const [activeCall, setActiveCall] = useState<{
    sessionId: string;
    callerNumber: string;
    direction: "INBOUND" | "OUTBOUND";
    status: "RINGING" | "ANSWERED" | "COMPLETED";
    customer: {
      id: string;
      name: string;
      phone: string;
      isVip: boolean;
      totalOrders: number;
      totalSpent: number;
      allergies: string[];
      notes: string;
    } | null;
    recentOrders: Array<{ id: string; summary: string; total: number; date: string }>;
    addresses: Array<{ id: string; address: string; isDefault: boolean }>;
  } | null>({
    sessionId: "call_sim_9821",
    callerNumber: "052-4455667",
    direction: "INBOUND",
    status: "RINGING",
    customer: {
      id: "cust-vip-1",
      name: "דניאל גולדשטיין",
      phone: "052-4455667",
      isVip: true,
      totalOrders: 18,
      totalSpent: 2640,
      allergies: ["בוטנים"],
      notes: "אוהב רוטב שום כפול, לבקש מהשליח לצלצל באינטרקום 12",
    },
    recentOrders: [
      { id: "ORD-9912", summary: "2x המבורגר קלאסי + צ'יפס ענק", total: 138, date: "לפני 3 ימים" },
      { id: "ORD-9450", summary: "1x כריך אנטריקוט + קולה זירו", total: 84, date: "לפני שבועיים" },
    ],
    addresses: [
      { id: "addr-1", address: "רוטשילד 45, תל אביב (קומה 3, דירה 8)", isDefault: true },
    ],
  });

  const [callHistory, setCallHistory] = useState([
    { id: "log-1", caller: "052-4455667", name: "דניאל גולדשטיין", duration: "03:42", status: "COMPLETED", time: "15:40", greeting: true },
    { id: "log-2", caller: "054-9988123", name: "לקוח לא מזוהה", duration: "00:00", status: "MISSED", time: "14:15", greeting: true },
    { id: "log-3", caller: "050-1234567", name: "מיכל אברהמי", duration: "02:18", status: "COMPLETED", time: "13:02", greeting: true },
  ]);

  const [simPhoneNumber, setSimPhoneNumber] = useState("054-8899771");

  // Phase 8: Integration Hub State
  const [integrationProviders] = useState([
    { id: "wolt", name: "Wolt", nameHe: "וולט", type: "AGGREGATOR", status: "CONNECTED", ordersToday: 14, lastSync: "לפני 2 דקות", color: "bg-sky-500", icon: "🛵" },
    { id: "tenbis", name: "10bis", nameHe: "תן ביס", type: "AGGREGATOR", status: "CONNECTED", ordersToday: 8, lastSync: "לפני 5 דקות", color: "bg-orange-500", icon: "🏢" },
    { id: "mishloha", name: "Mishloha", nameHe: "משלוחה", type: "AGGREGATOR", status: "CONNECTED", ordersToday: 3, lastSync: "לפני 12 דקות", color: "bg-emerald-500", icon: "🍕" },
    { id: "green-invoice", name: "Green Invoice", nameHe: "חשבונית ירוקה", type: "INVOICING", status: "CONNECTED", invoicesToday: 22, lastSync: "לפני 1 דקה", color: "bg-green-600", icon: "🧾" },
    { id: "rivhit", name: "Rivhit", nameHe: "רווחית", type: "INVOICING", status: "STANDBY", invoicesToday: 0, lastSync: "—", color: "bg-indigo-500", icon: "📊" },
    { id: "icount", name: "iCount", nameHe: "אייקאונט", type: "INVOICING", status: "STANDBY", invoicesToday: 0, lastSync: "—", color: "bg-violet-500", icon: "📑" },
    { id: "meshulam", name: "Meshulam", nameHe: "משולם", type: "PAYMENT", status: "CONNECTED", txToday: 19, lastSync: "לפני 30 שניות", color: "bg-blue-600", icon: "💳" },
    { id: "stripe", name: "Stripe", nameHe: "סטרייפ", type: "PAYMENT", status: "CONNECTED", txToday: 5, lastSync: "לפני 3 דקות", color: "bg-purple-600", icon: "🌐" },
  ]);

  const [webhookLog, setWebhookLog] = useState([
    { id: "wh-1", provider: "Wolt", eventType: "ORDER_CREATED", orderId: "ORD-020024", status: "SUCCESS", pipeline: "10/10", timestamp: "15:44:12", amount: 125.00 },
    { id: "wh-2", provider: "10bis", eventType: "ORDER_CREATED", orderId: "ORD-020025", status: "SUCCESS", pipeline: "10/10", timestamp: "15:42:08", amount: 78.00 },
    { id: "wh-3", provider: "Meshulam", eventType: "PAYMENT_CAPTURED", orderId: "PAY-8821", status: "SUCCESS", pipeline: "—", timestamp: "15:40:55", amount: 203.00 },
    { id: "wh-4", provider: "Wolt", eventType: "ORDER_CREATED", orderId: "ORD-020023", status: "DUPLICATE", pipeline: "4/10", timestamp: "15:38:30", amount: 125.00 },
    { id: "wh-5", provider: "Green Invoice", eventType: "INVOICE_ISSUED", orderId: "INV-305-4412", status: "SUCCESS", pipeline: "—", timestamp: "15:35:18", amount: 168.00 },
  ]);

  const [retryQueue, setRetryQueue] = useState([
    { id: "retry-1", provider: "10bis", eventType: "STATUS_UPDATE", attempt: 2, maxAttempts: 5, nextRetry: "בעוד 30 שניות", status: "RETRYING" },
  ]);

  const [deadLetters, setDeadLetters] = useState<Array<{ id: string; provider: string; eventType: string; failedAt: string; reason: string }>>([
    { id: "dl-1", provider: "Wolt", eventType: "ORDER_CREATED", failedAt: "15:20:10", reason: "Invalid HMAC Signature (401)" },
  ]);

  const [selectedPipelineStep, setSelectedPipelineStep] = useState<number | null>(null);
  const [integrationToast, setIntegrationToast] = useState<string | null>(null);

  const simulateWebhook = (provider: string) => {
    const newEntry = {
      id: `wh-${Date.now().toString().slice(-6)}`,
      provider,
      eventType: "ORDER_CREATED",
      orderId: `ORD-${Math.floor(Math.random() * 900000 + 100000)}`,
      status: "SUCCESS" as const,
      pipeline: "10/10",
      timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      amount: Math.floor(Math.random() * 200 + 50),
    };
    setWebhookLog((prev) => [newEntry, ...prev.slice(0, 9)]);
    setIntegrationToast(`✅ Webhook ${provider} נקלט — הזמנה ${newEntry.orderId} עובדה ב-10/10 שלבי הפייפליין!`);
    setTimeout(() => setIntegrationToast(null), 4000);
  };

  const simulateInvoice = (provider: string) => {
    const invId = `INV-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const newEntry = {
      id: `wh-${Date.now().toString().slice(-6)}`,
      provider,
      eventType: "INVOICE_ISSUED",
      orderId: invId,
      status: "SUCCESS" as const,
      pipeline: "10/10",
      timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      amount: Math.floor(Math.random() * 250 + 60),
    };
    setWebhookLog((prev) => [newEntry, ...prev.slice(0, 9)]);
    setIntegrationToast(`🧾 חשבונית מס קבלה ${invId} הופקה בהצלחה דרך מתאם ${provider}!`);
    setTimeout(() => setIntegrationToast(null), 4000);
  };

  const simulatePayment = (provider: string) => {
    const payId = `PAY-${Math.floor(Math.random() * 9000 + 1000)}`;
    const amt = Math.floor(Math.random() * 300 + 80);
    const newEntry = {
      id: `wh-${Date.now().toString().slice(-6)}`,
      provider,
      eventType: "PAYMENT_CAPTURED",
      orderId: payId,
      status: "SUCCESS" as const,
      pipeline: "10/10",
      timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      amount: amt,
    };
    setWebhookLog((prev) => [newEntry, ...prev.slice(0, 9)]);
    setIntegrationToast(`💳 עסקת סליקה ${payId} בסך ₪${amt}.00 אושרה בהצלחה דרך ${provider}!`);
    setTimeout(() => setIntegrationToast(null), 4000);
  };

  const replayDeadLetter = (id: string) => {
    const item = deadLetters.find((d) => d.id === id);
    if (!item) return;
    setDeadLetters((prev) => prev.filter((d) => d.id !== id));
    const newEntry = {
      id: `wh-${Date.now().toString().slice(-6)}`,
      provider: item.provider,
      eventType: item.eventType,
      orderId: `ORD-${Math.floor(Math.random() * 900000 + 100000)}`,
      status: "SUCCESS" as const,
      pipeline: "10/10",
      timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      amount: 145,
    };
    setWebhookLog((prev) => [newEntry, ...prev.slice(0, 9)]);
    setIntegrationToast(`🔄 הודעה ${id} (${item.provider}) שוגרה מחדש בהצלחה והושלמה ב-100%!`);
    setTimeout(() => setIntegrationToast(null), 4000);
  };

  const processRetryNow = (id: string) => {
    const item = retryQueue.find((r) => r.id === id);
    if (!item) return;
    setRetryQueue((prev) => prev.filter((r) => r.id !== id));
    setIntegrationToast(`⚡ ניסיון חוזר ל-${item.provider} בוצע בהצלחה (200 OK)!`);
    setTimeout(() => setIntegrationToast(null), 4000);
  };

  const simulateDeadLetter = () => {
    const newDl = {
      id: `dl-${Date.now().toString().slice(-4)}`,
      provider: ["Wolt", "10bis", "Mishloha"][Math.floor(Math.random() * 3)],
      eventType: "ORDER_CREATED",
      failedAt: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      reason: "Max retries (5) exceeded — Upstream timeout",
    };
    setDeadLetters((prev) => [newDl, ...prev]);
    setIntegrationToast(`⚠️ הודעה ${newDl.id} נרשמה ב-Dead-Letter Queue לצורך בדיקה או Replay`);
    setTimeout(() => setIntegrationToast(null), 4000);
  };

  const triggerSimulatedCall = (isNewCustomer: boolean) => {
    if (isNewCustomer) {
      setActiveCall({
        sessionId: `call_sim_${Date.now().toString().slice(-4)}`,
        callerNumber: simPhoneNumber,
        direction: "INBOUND",
        status: "RINGING",
        customer: null,
        recentOrders: [],
        addresses: [],
      });
    } else {
      setActiveCall({
        sessionId: `call_sim_${Date.now().toString().slice(-4)}`,
        callerNumber: "052-4455667",
        direction: "INBOUND",
        status: "RINGING",
        customer: {
          id: "cust-vip-1",
          name: "דניאל גולדשטיין",
          phone: "052-4455667",
          isVip: true,
          totalOrders: 18,
          totalSpent: 2640,
          allergies: ["בוטנים"],
          notes: "אוהב רוטב שום כפול, לבקש מהשליח לצלצל באינטרקום 12",
        },
        recentOrders: [
          { id: "ORD-9912", summary: "2x המבורגר קלאסי + צ'יפס ענק", total: 138, date: "לפני 3 ימים" },
        ],
        addresses: [
          { id: "addr-1", address: "רוטשילד 45, תל אביב (קומה 3, דירה 8)", isDefault: true },
        ],
      });
    }
  };

  return (
    <main className="min-h-screen bg-surface p-4 sm:p-8 font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Operational Header */}
        <header className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-container text-white">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  RestaurantOS — Unified Core v1.4
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  סניף: ראשי תל אביב
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  בידוד RLS פעיל
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
                מרכז שליטה ובקרה תפעולי
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                מערך לוגיסטיקה, מטבח (KDS), ניתוב משלוחים חכם וניהול רשת מסעדות בזמן אמת.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-lg text-xs font-bold text-gray-700">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>WebSocket חי (כרטיס 60s)</span>
              </div>
              <div className="bg-primary text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>שעון משמרת: 01:45</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-gray-100">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "overview"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              סקירה כללית & תשתית
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "orders"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Package className="w-4 h-4" />
              הזמנות אוניברסליות & CRM
            </button>
            <button
              onClick={() => setActiveTab("kds")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "kds"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ChefHat className="w-4 h-4" />
              מטבח KDS & מסילות כרטיסים
            </button>
            <button
              onClick={() => setActiveTab("delivery")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "delivery"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Bike className="w-4 h-4" />
              משלוחים, תור FIFO & צי רכב
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "inventory"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Boxes className="w-4 h-4" />
              מלאי, מתכוני BOM & מחסנים (Phase 5)
            </button>
            <button
              onClick={() => setActiveTab("marketing")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "marketing"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Gift className="w-4 h-4 text-pink-500" />
              שיווק, מועדון & קופונים (Phase 6)
            </button>
            <button
              onClick={() => setActiveTab("telephony")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "telephony"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <PhoneCall className="w-4 h-4 text-amber-500" />
              טלפוניה ו-Caller ID (Phase 7)
            </button>
            <button
              onClick={() => setActiveTab("integrations")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "integrations"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Plug className="w-4 h-4 text-cyan-500" />
              אינטגרציות ו-Webhooks (Phase 8)
            </button>
            <button
              onClick={() => setActiveTab("storefront")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "storefront"
                  ? "bg-amber-500 text-zinc-950 shadow-sm font-black"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Globe className="w-4 h-4 text-orange-500" />
              אתר הזמנות וקיוסק (Phase 9)
            </button>
          </nav>
        </header>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setActiveTab("orders")}
                role="button"
                tabIndex={0}
                className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-start gap-4 group"
              >
                <div className="p-3 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Server className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Multi-Tenancy</h3>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-[-2px] transition-all" />
                  </div>
                  <p className="text-xl font-black text-primary mt-0.5">Org / Branch</p>
                  <p className="text-xs text-gray-500 mt-1">בידוד PostgreSQL RLS מלא</p>
                </div>
              </div>

              <div
                onClick={() => setActiveTab("orders")}
                role="button"
                tabIndex={0}
                className="bg-white p-5 rounded-xl border border-gray-200 hover:border-purple-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-start gap-4 group"
              >
                <div className="p-3 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Authentication</h3>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-600 group-hover:translate-x-[-2px] transition-all" />
                  </div>
                  <p className="text-xl font-black text-primary mt-0.5">RBAC (12 Roles)</p>
                  <p className="text-xs text-gray-500 mt-1">עוגיות HttpOnly + PIN מהיר</p>
                </div>
              </div>

              <div
                onClick={() => setActiveTab("integrations")}
                role="button"
                tabIndex={0}
                className="bg-white p-5 rounded-xl border border-gray-200 hover:border-amber-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-start gap-4 group"
              >
                <div className="p-3 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Database className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit & Outbox</h3>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-600 group-hover:translate-x-[-2px] transition-all" />
                  </div>
                  <p className="text-xl font-black text-primary mt-0.5">Transactional</p>
                  <p className="text-xs text-gray-500 mt-1">100% Immutable Event Ledger</p>
                </div>
              </div>

              <div
                onClick={() => setActiveTab("kds")}
                role="button"
                tabIndex={0}
                className="bg-white p-5 rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-start gap-4 group"
              >
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Radio className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Realtime Mesh</h3>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-600 group-hover:translate-x-[-2px] transition-all" />
                  </div>
                  <p className="text-xl font-black text-primary mt-0.5">Redis Ephemeral</p>
                  <p className="text-xs text-gray-500 mt-1">כרטיסי אימות ערוץ ל-60 שניות</p>
                </div>
              </div>
            </section>

            {/* Architecture Evolution Grid */}
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  סטטוס שלבי הפיתוח (Phased Roadmap Alignment)
                </h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  שלבים 1 עד 8 הושלמו בהצלחה (254/254 בדיקות)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {/* Phase 1 */}
                <div
                  onClick={() => setIntegrationToast("🛡️ Phase 1 (Foundation): תשתית האבטחה, הבידוד ויומן האירועים פועלים ברקע של כל המודולים")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-800">Phase 1: Foundation</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">אבטחה, אימות ו-Outbox</p>
                    <p className="text-xs text-gray-600">
                      בידוד ארגוני, טוקנים מאובטחים, Rate Limiter, ואימות Webhooks בחתימת HMAC-SHA256.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>תשתית פלטפורמה</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                      פרטים <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Phase 2 */}
                <div
                  onClick={() => setActiveTab("orders")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-800">Phase 2: CRM & Orders</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">הזמנות אוניברסליות ותפריט</p>
                    <p className="text-xs text-gray-600">
                      מנוע הזמנות עמיד, ניהול מודולרי של תוספות ומידות עשייה, וכרטיס לקוח VIP.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>עבור למסך הזמנות</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                      פתח מודול <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Phase 3 */}
                <div
                  onClick={() => setActiveTab("kds")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-800">Phase 3: KDS</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">מסילות כרטיסים ו-SLA</p>
                    <p className="text-xs text-gray-600">
                      ניתוב פריטים לפי תחנות עבודה (המבורגר, צ'יפס, שתייה), ניטור זמנים ויזואלי והתראות חריגה.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>עבור למטבח KDS</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                      פתח מודול <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Phase 4 */}
                <div
                  onClick={() => setActiveTab("delivery")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-800">Phase 4: Delivery & Fleet</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">משלוחים, תור FIFO ואיחוד חכם</p>
                    <p className="text-xs text-gray-600">
                      מודל נהג 3-ממדי, שיוך עצמי מוגן קונפליקטים (409), טלמטריה וגאופנס 150מ' מייעץ.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>עבור למשלוחים וצי</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                      פתח מודול <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Phase 5 */}
                <div
                  onClick={() => setActiveTab("inventory")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-800">Phase 5: Inventory & BOM</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">מלאי, עצי מוצר וספקים</p>
                    <p className="text-xs text-gray-600">
                      מדיניות ניפוק מוגדרת (ON_ACCEPTED), המרת יחידות מידה, תנועות מלאי ומניעת מלאי שלילי.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>עבור למלאי ו-BOM</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                      פתח מודול <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Phase 6 */}
                <div
                  onClick={() => setActiveTab("marketing")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-800">Phase 6: Marketing & Loyalty</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">קמפיינים, מועדון 3 דרגות ומבצעים</p>
                    <p className="text-xs text-gray-600">
                      מועדון לקוחות (לקוח חדש, קבוע, VIP), מנוע חוקים דטרמיניסטי, קופונים עם מכסות ושיגור SMS/WhatsApp.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>עבור לשיווק ומועדון</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                      פתח מודול <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Phase 7 */}
                <div
                  onClick={() => setActiveTab("telephony")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-800">Phase 7: Telephony PBX & Caller ID</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">מרכזיית טלפוניה וזיהוי שיחה חכם</p>
                    <p className="text-xs text-gray-600">
                      מתאם SIP/WebRTC, זיהוי מתקשר בזמן אמת, שליפת נתוני CRM, עמידה בחוק הישראלי ויצירת הזמנה טלפונית.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>עבור לטלפוניה</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                      פתח מודול <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Phase 8 */}
                <div
                  onClick={() => setActiveTab("integrations")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border-2 border-emerald-500 bg-emerald-50/70 hover:bg-emerald-50 hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer space-y-2 group md:col-span-2 lg:col-span-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                        <Plug className="w-4 h-4 text-emerald-700" />
                        Phase 8: Integration Hub & Normalized Adapters
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white shadow-sm">הושלם (254/254 בדיקות)</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-900">מערכת אינטגרציות מנורמלת — אגרגטורים, חשבוניות ותשלומים</p>
                    <p className="text-xs text-gray-600">
                      פייפליין 10-שלבי מנורמל (HMAC-SHA256, Replay Protection, Idempotency, Zod Validation), מתאמי Wolt/10bis/Mishloha, חשבוניות ירוקה/Rivhit/iCount, סליקה Meshulam/Stripe, Dead-Letter Queue ו-Exponential Backoff Retries.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-emerald-200 flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Wolt, 10bis, Mishloha, Green Invoice, Meshulam, Stripe
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm group-hover:bg-emerald-700 group-hover:translate-x-[-3px] transition-all">
                      פתח מסך אינטגרציות <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: UNIVERSAL ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-primary">יומן הזמנות פעיל (Universal Orders Ledger)</h2>
                  <p className="text-xs text-gray-500">
                    כל ההזמנות מכל הערוצים (משלוח, טייק אוויי, ישיבה במסעדה) במבנה נתונים אחיד.
                  </p>
                </div>
                <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-gray-800 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  רענן הזמנות
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3">מספר הזמנה</th>
                      <th className="p-3">ערוץ</th>
                      <th className="p-3">לקוח / טלפון</th>
                      <th className="p-3">פירוט פריטים</th>
                      <th className="p-3">סכום כולל</th>
                      <th className="p-3">סטטוס תפעולי</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ordersList.map((ord) => (
                      <tr key={ord.id} className="hover:bg-gray-50/75">
                        <td className="p-3 font-bold text-primary font-mono">{ord.id}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${ord.channelBg}`}>
                            {ord.channelLabel}
                          </span>
                        </td>
                        <td className="p-3 font-medium">
                          {ord.customer}
                          {ord.isVip && (
                            <span className="mr-1.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                              VIP
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-gray-700">{ord.items}</td>
                        <td className="p-3 font-bold tabular-nums font-mono">₪{ord.total.toFixed(2)}</td>
                        <td className="p-3">
                          <StatusBadge status={ord.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: KITCHEN DISPLAY SYSTEM */}
        {activeTab === "kds" && (
          <div className="space-y-6">
            {/* KDS Station Headers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tickets.map((ticket) => {
                const isOverdue = ticket.slaStatus === "SLA_EXCEEDED";
                const isWarning = ticket.slaStatus === "NEAR_SLA";

                return (
                  <div
                    key={ticket.id}
                    className={`rounded-xl border shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                      isOverdue
                        ? "border-red-500 bg-red-50/20"
                        : isWarning
                        ? "border-amber-400 bg-amber-50/20"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {/* Header */}
                    <div
                      className={`p-4 border-b flex items-center justify-between ${
                        isOverdue
                          ? "bg-red-600 text-white font-black"
                          : isWarning
                          ? "bg-amber-100 text-amber-900 font-bold border-amber-200"
                          : "bg-gray-50 text-gray-800 font-bold border-gray-200"
                      }`}
                    >
                      <div>
                        <span className="text-xs uppercase tracking-wider block opacity-90">{ticket.stationName}</span>
                        <span className="text-lg">{ticket.orderNumber}</span>
                      </div>
                      <div className="text-left font-mono text-sm tabular-nums">
                        {isOverdue && <span className="animate-pulse mr-1">⚠️ +</span>}
                        {Math.floor(ticket.elapsedSeconds / 60)}:
                        {(ticket.elapsedSeconds % 60).toString().padStart(2, "0")}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3 flex-1">
                      <div className="space-y-1.5">
                        {ticket.items.map((item, idx) => (
                          <div key={idx} className="text-xs font-bold text-gray-800 flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">
                        {ticket.status === "READY" ? "מוכן לחלוקה" : "בהכנה בפס"}
                      </span>
                      <button
                        onClick={() => bumpTicket(ticket.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          ticket.status === "READY"
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-primary text-white hover:bg-gray-800"
                        }`}
                      >
                        {ticket.status === "READY" ? "סיים הגשה (Bump)" : "סמן כמוכן (Ready)"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: DELIVERY & FLEET */}
        {activeTab === "delivery" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1 & 2: FIFO Queue & Active Deliveries */}
              <div className="lg:col-span-2 space-y-6">
                {/* FIFO Driver Queue */}
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                      <Bike className="w-5 h-5 text-blue-600" />
                      תור זמינות נהגים (Deterministic FIFO Queue)
                    </h2>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      סדר עדיפות לפי available_since
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                        <tr>
                          <th className="p-3">מיקום בתור</th>
                          <th className="p-3">שם השליח</th>
                          <th className="p-3">משמרת</th>
                          <th className="p-3">זמינות</th>
                          <th className="p-3">כלי רכב משויך</th>
                          <th className="p-3">זמין מאז</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {driverQueue.map((drv) => (
                          <tr key={drv.id} className="hover:bg-gray-50/75">
                            <td className="p-3 font-extrabold text-blue-600 tabular-nums">#{drv.position}</td>
                            <td className="p-3 font-bold text-gray-900">{drv.name}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                drv.status === "ON_SHIFT" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                              }`}>
                                {drv.status === "ON_SHIFT" ? "במשמרת" : "בהפסקה"}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-gray-600">
                              {drv.assignment === "AVAILABLE" ? "זמין להקצאה" : "לא זמין"}
                            </td>
                            <td className="p-3 text-gray-700 font-medium">{drv.vehicle}</td>
                            <td className="p-3 text-gray-500">{drv.availableSince}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Smart Batching Recommendation Card */}
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <h2 className="text-lg font-bold text-primary">הצעת איחוד משלוחים חכמה (Advisory Batch)</h2>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      ציון התאמה: 88.4 / 100
                    </span>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg space-y-3 text-xs">
                    <div className="flex justify-between items-center text-gray-700">
                      <span className="font-bold">הזמנות מועמדות לאיחוד:</span>
                      <span className="font-mono font-bold text-primary">ORD-1042 + ORD-1045 (רחוב דיזנגוף 50 & 72)</span>
                    </div>

                    {/* Breakdown bars */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                      <div className="bg-white p-2.5 rounded border border-gray-200 text-center">
                        <span className="text-gray-500 block text-[10px]">קרבה גיאוגרפית</span>
                        <span className="font-black text-emerald-600 text-sm">94%</span>
                      </div>
                      <div className="bg-white p-2.5 rounded border border-gray-200 text-center">
                        <span className="text-gray-500 block text-[10px]">יישור אזימוט (35°)</span>
                        <span className="font-black text-blue-600 text-sm">91%</span>
                      </div>
                      <div className="bg-white p-2.5 rounded border border-gray-200 text-center">
                        <span className="text-gray-500 block text-[10px]">סנכרון מטבח</span>
                        <span className="font-black text-purple-600 text-sm">85%</span>
                      </div>
                      <div className="bg-white p-2.5 rounded border border-gray-200 text-center">
                        <span className="text-gray-500 block text-[10px]">מרווח SLA</span>
                        <span className="font-black text-amber-600 text-sm">82%</span>
                      </div>
                    </div>

                    {batchActionStatus ? (
                      <div className="p-3 bg-emerald-50 text-emerald-800 rounded font-bold text-center border border-emerald-200">
                        {batchActionStatus}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={() => setBatchActionStatus("האיחוד אושר בהצלחה ושויך לנהג הראשון בתור (#1 דני כהן)")}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          אשר איחוד משלוח (Approve Batch)
                        </button>
                        <button
                          onClick={() => setBatchActionStatus("האיחוד נדחה — נרשם ביומן ההחלטות ללמידה עתידית")}
                          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          דחה איחוד (Reject)
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Column 3: Live Telematics & Geofence Rule */}
              <div className="space-y-6">
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                    <Navigation className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-bold text-primary">טלמטריה וגאופנס צי רכב</h2>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                      <span className="font-bold block mb-1">כלל הברזל של המערכת:</span>
                      <span className="font-mono text-xs font-semibold">Telemetry != Business Truth</span>
                      <p className="text-[11px] text-blue-800 mt-1">
                        כניסה לרדיוס 150 מ' מעדכנת סטטוס ל-ARRIVED_AT_CUSTOMER_AREA בלבד, ולעולם לא מסמנת DELIVERED ללא אישור אנושי / חתימה.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
                      <div className="flex justify-between items-center font-bold text-gray-800">
                        <span>רכב: 11-222-33 (קטנוע)</span>
                        <span className="text-emerald-600 flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                          משדר Online
                        </span>
                      </div>
                      <div className="text-gray-600 space-y-0.5">
                        <p>שליח משויך: דני כהן</p>
                        <p>סוללת איתוראן: 98%</p>
                        <p>מהירות נוכחית: 34 קמ"ש</p>
                        <p>מיקום נוכחי: 32.0626, 34.7703 (דיזנגוף 50)</p>
                        <p className="font-bold text-emerald-700 mt-1">סטטוס גאופנס: בתוך רדיוס 150 מ' מהיעד</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: INVENTORY & LOGISTICS MANAGEMENT */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            {/* Top Bar: Operational Policy Switcher & Highlights */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                  <Boxes className="w-6 h-6 text-blue-600" />
                  <div>
                    <h2 className="text-lg font-bold text-primary">מערך מלאי, עצי מוצר (BOM) ומחסנים — Phase 5</h2>
                    <p className="text-xs text-gray-500">
                      ניהול רב-מחסני, ניפוק אוטומטי מבוסס עצי מוצר, העברות בין סניפים, בקרת פחת ורכש ספקים
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 text-xs">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-blue-900">מדיניות ניפוק פעילה:</span>
                  <span className="font-mono font-extrabold text-blue-700">ON_ACCEPTED (ברירת מחדל קנונית)</span>
                </div>
              </div>

              {/* Real-time Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
                    <span>חומרי גלם מנוהלים</span>
                    <Package className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-gray-900">5</div>
                  <div className="text-[11px] text-emerald-600 mt-1 font-semibold">בקר, לחמניות, צ'דר, רטבים, תפ"א</div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
                    <span>מחסנים פעילים</span>
                    <Boxes className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-black text-gray-900">3</div>
                  <div className="text-[11px] text-gray-500 mt-1">ראשי, פס הכנה מטבח, חדר הקפאה</div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
                    <span>התראות מלאי נמוך</span>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-600">0</div>
                  <div className="text-[11px] text-emerald-600 mt-1 font-semibold">כל המלאים מעל נקודת הזמנה</div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
                    <span>עלות פחת מצטברת</span>
                    <Flame className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-black text-rose-600">₪22.00</div>
                  <div className="text-[11px] text-gray-500 mt-1">2 רישומי פחת השבוע</div>
                </div>
              </div>
            </div>

            {/* Two Column Layout: Live Stock Levels & Interactive BOM Calculator */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Warehouse Stock Levels */}
              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-900">רמות מלאי נוכחיות (מקרר פס הכנה — Kitchen Line)</h3>
                  </div>
                  <span className="text-xs text-gray-500">עודכן הרגע</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">בשר בקר טחון לקציצות</div>
                      <div className="text-gray-500 text-[11px]">מק"ט: ING-BEEF-01 | יחידת ניפוק: גרם (g)</div>
                    </div>
                    <div className="text-left">
                      <div className="font-mono font-extrabold text-sm text-gray-900">44,000 g (44.0 kg)</div>
                      <div className="text-emerald-600 text-[11px] font-semibold">סף מינימום: 5,000 g | תקין</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">לחמניית בריוש שומשום</div>
                      <div className="text-gray-500 text-[11px]">מק"ט: ING-BUN-01 | יחידת ניפוק: יחידה (unit)</div>
                    </div>
                    <div className="text-left">
                      <div className="font-mono font-extrabold text-sm text-gray-900">200 יח'</div>
                      <div className="text-emerald-600 text-[11px] font-semibold">נקודת הזמנה: 150 יח' | תקין</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">פרוסות צ'דר איכותי</div>
                      <div className="text-gray-500 text-[11px]">מק"ט: ING-CHEDDAR-01 | יחידת ניפוק: יחידה (unit)</div>
                    </div>
                    <div className="text-left">
                      <div className="font-mono font-extrabold text-sm text-gray-900">150 יח'</div>
                      <div className="text-emerald-600 text-[11px] font-semibold">נקודת הזמנה: 100 יח' | תקין</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">רוטב הבית שורטק</div>
                      <div className="text-gray-500 text-[11px]">מק"ט: ING-SAUCE-01 | יחידת ניפוק: מ"ל (ml)</div>
                    </div>
                    <div className="text-left">
                      <div className="font-mono font-extrabold text-sm text-gray-900">8,000 ml (8.0 L)</div>
                      <div className="text-emerald-600 text-[11px] font-semibold">נקודת הזמנה: 5,000 ml | תקין</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">תפוחי אדמה חתוכים לצ'יפס</div>
                      <div className="text-gray-500 text-[11px]">מק"ט: ING-POTATO-01 | יחידת ניפוק: גרם (g)</div>
                    </div>
                    <div className="text-left">
                      <div className="font-mono font-extrabold text-sm text-gray-900">35,000 g (35.0 kg)</div>
                      <div className="text-emerald-600 text-[11px] font-semibold">נקודת הזמנה: 30,000 g | תקין</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Right Column: Live BOM Explosion Calculator */}
              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-600" />
                    <h3 className="text-sm font-bold text-gray-900">מחשבון עצי מוצר (BOM) ועלות מזון תיאורטית</h3>
                  </div>
                  <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold">חישוב בזמן אמת</span>
                </div>

                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">מנה נבחרת: המבורגר קלאסי 220 גרם</span>
                    <span className="font-bold text-purple-900">מחיר מכירה ללקוח: ₪58.00</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-white text-gray-600 font-bold border-b border-purple-200">
                        <tr>
                          <th className="p-2">חומר גלם</th>
                          <th className="p-2">כמות ברוטו (כולל פחת)</th>
                          <th className="p-2">עלות יחידה</th>
                          <th className="p-2">סה"כ עלות</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100 bg-white/70">
                        <tr>
                          <td className="p-2 font-semibold">בשר בקר טחון (95% Yield)</td>
                          <td className="p-2 font-mono">231.58 g</td>
                          <td className="p-2 font-mono">₪0.075 / g</td>
                          <td className="p-2 font-mono font-bold">₪17.37</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-semibold">לחמניית בריוש שומשום</td>
                          <td className="p-2 font-mono">1.00 יח'</td>
                          <td className="p-2 font-mono">₪2.20 / יח'</td>
                          <td className="p-2 font-mono font-bold">₪2.20</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-semibold">רוטב הבית שורטק (98% Yield)</td>
                          <td className="p-2 font-mono">30.61 ml</td>
                          <td className="p-2 font-mono">₪0.040 / ml</td>
                          <td className="p-2 font-mono font-bold">₪1.22</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-semibold text-purple-700">תוספת: פרוסת צ'דר</td>
                          <td className="p-2 font-mono">1.00 יח'</td>
                          <td className="p-2 font-mono">₪1.10 / יח'</td>
                          <td className="p-2 font-mono font-bold">₪1.10</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-2 border-t border-purple-200 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-gray-600">עלות מזון תיאורטית (Theoretical Cost): </span>
                      <span className="font-bold text-gray-900 font-mono text-sm">₪21.89</span>
                    </div>
                    <div className="text-left">
                      <span className="text-gray-600">Food Cost %: </span>
                      <span className="font-bold text-emerald-700 font-mono text-sm">37.7%</span>
                      <span className="text-gray-400 text-[10px] block">רווח גולמי: 62.3%</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* TAB 6: MARKETING, PROMOTIONS & LOYALTY (Phase 6) */}
        {activeTab === "marketing" && (
          <div className="space-y-6">
            {/* Action Toast */}
            {dispatchToast && (
              <div className="bg-emerald-600 text-white p-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                  <span>{dispatchToast}</span>
                </div>
                <button onClick={() => setDispatchToast(null)} className="text-emerald-200 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quick Metrics Bar */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-pink-50 text-pink-600">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">קמפיינים פעילים</h3>
                  <p className="text-xl font-black text-primary mt-0.5">{campaigns.filter((c) => c.status === "ACTIVE").length} פעילים</p>
                  <p className="text-xs text-gray-500 mt-1">מתוך {campaigns.length} קמפיינים מוגדרים</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
                  <Tag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">קופונים ומכסות</h3>
                  <p className="text-xl font-black text-primary mt-0.5">3 קופונים פעילים</p>
                  <p className="text-xs text-gray-500 mt-1">מכסות שימוש גלובליות ואישיות</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">חברי מועדון</h3>
                  <p className="text-xl font-black text-primary mt-0.5">1,280 לקוחות</p>
                  <p className="text-xs text-emerald-600 font-semibold mt-1">צבירת 1 נקודה לכל ₪1</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">לקוחות VIP</h3>
                  <p className="text-xl font-black text-primary mt-0.5">84 לקוחות (6.5%)</p>
                  <p className="text-xs text-purple-600 font-semibold mt-1">דרגה עליונה (2,000+ נק')</p>
                </div>
              </div>
            </section>

            {/* Main Interactive Grid: Loyalty (Left) + Coupons/Promos (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Column 1: Canonical 3-Tier Loyalty System */}
              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <div>
                      <h2 className="text-base font-bold text-primary">מועדון לקוחות — 3 דרגות קנוניות</h2>
                      <p className="text-xs text-gray-500">
                        הגדרת ברירת מחדל: לקוח חדש, לקוח קבוע, לקוח VIP עם חישוב דטרמיניסטי.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    נקודה = ₪0.10
                  </span>
                </div>

                {/* 3 Tier Badges Showcase */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/60">
                    <div className="font-extrabold text-blue-900 text-sm">לקוח חדש</div>
                    <div className="text-blue-700 font-mono text-[11px] mt-0.5">0 – 499 נק'</div>
                    <div className="text-gray-500 text-[10px] mt-1">הצטרפות אוטומטית בקנייה ראשונה</div>
                  </div>
                  <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60">
                    <div className="font-extrabold text-emerald-900 text-sm">לקוח קבוע</div>
                    <div className="text-emerald-700 font-mono text-[11px] mt-0.5">500 – 1,999 נק'</div>
                    <div className="text-gray-500 text-[10px] mt-1">הטבת יום הולדת + עדיפות משלוח</div>
                  </div>
                  <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/60">
                    <div className="font-extrabold text-purple-900 text-sm">לקוח VIP</div>
                    <div className="text-purple-700 font-mono text-[11px] mt-0.5">2,000+ נק'</div>
                    <div className="text-gray-500 text-[10px] mt-1">משלוח חינם קבוע + מנות שף</div>
                  </div>
                </div>

                {/* Interactive Member Account Card */}
                {(() => {
                  const tier = getTierInfo(loyaltyMember.lifetimePoints);
                  const nextThreshold = loyaltyMember.lifetimePoints < 500 ? 500 : 2000;
                  const ptsNeeded = Math.max(0, nextThreshold - loyaltyMember.lifetimePoints);
                  const progressPct =
                    loyaltyMember.lifetimePoints >= 2000
                      ? 100
                      : Math.min(
                          100,
                          Math.round(
                            ((loyaltyMember.lifetimePoints - (loyaltyMember.lifetimePoints >= 500 ? 500 : 0)) /
                              (nextThreshold - (loyaltyMember.lifetimePoints >= 500 ? 500 : 0))) *
                              100
                          )
                        );

                  return (
                    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-500">כרטיס חבר מועדון לבדיקה:</div>
                          <div className="font-bold text-gray-900 text-sm">{loyaltyMember.name}</div>
                          <div className="text-gray-500 text-xs font-mono">{loyaltyMember.phone}</div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold border ${tier.color}`}>
                          <span>{tier.icon}</span>
                          <span>{tier.label}</span>
                        </span>
                      </div>

                      {/* Points Balances */}
                      <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-gray-200 text-center text-xs">
                        <div>
                          <div className="text-gray-500 text-[11px]">יתרה לפדיון</div>
                          <div className="text-lg font-black text-primary font-mono">{loyaltyMember.currentPoints}</div>
                          <div className="text-[10px] text-gray-400">שווי: ₪{(loyaltyMember.currentPoints * 0.1).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-[11px]">נקודות מצטברות</div>
                          <div className="text-lg font-black text-emerald-700 font-mono">{loyaltyMember.lifetimePoints}</div>
                          <div className="text-[10px] text-gray-400">קובע דרגה (לא מתאפס)</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-[11px]">סטטוס קידום</div>
                          <div className="text-sm font-bold text-purple-700 mt-1">
                            {loyaltyMember.lifetimePoints >= 2000 ? "דרגת שיא!" : `עוד ${ptsNeeded} נק'`}
                          </div>
                          <div className="text-[10px] text-gray-400">לדרגה הבאה</div>
                        </div>
                      </div>

                      {/* Tier Progress Bar */}
                      <div>
                        <div className="flex justify-between text-[11px] text-gray-600 mb-1">
                          <span>התקדמות לדרגה הבאה</span>
                          <span className="font-bold font-mono">{progressPct}%</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-purple-600 h-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Interactive Controls */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200">
                        <button
                          onClick={() => handleEarnPoints(150)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors shadow-sm"
                        >
                          + צבור 150 נקודות (הזמנה של ₪150)
                        </button>
                        <button
                          onClick={() => handleRedeemPoints(50)}
                          disabled={loyaltyMember.currentPoints < 50}
                          className="flex-1 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors shadow-sm"
                        >
                          - פדה 50 נקודות (הנחת ₪5.00)
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </section>

              {/* Column 2: Coupon Validator & Promotion Engine Simulator */}
              <section className="space-y-6">
                {/* 2A: Coupon Live Validator */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-5 h-5 text-indigo-600" />
                      <h2 className="text-base font-bold text-primary">בדיקת קופון בצ'ק-אאוט (Live Validator)</h2>
                    </div>
                    <span className="text-xs font-bold text-gray-500">אימות אטומי מוגן מכסות</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-gray-600 font-bold mb-1">קוד קופון:</label>
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value)}
                        placeholder="SUMMER15"
                        className="w-full uppercase font-mono p-2 border border-gray-300 rounded-lg text-gray-800 font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-bold mb-1">סכום הזמנה (₪):</label>
                      <input
                        type="number"
                        value={couponSubtotalInput}
                        onChange={(e) => setCouponSubtotalInput(Number(e.target.value))}
                        className="w-full font-mono p-2 border border-gray-300 rounded-lg text-gray-800 font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleValidateCoupon}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg transition-colors shadow-sm"
                      >
                        בדוק קופון
                      </button>
                    </div>
                  </div>

                  {/* Sample Codes Helper */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                    <span>קודים פעילים לבדיקה:</span>
                    <button
                      onClick={() => { setCouponCodeInput("SUMMER15"); setCouponSubtotalInput(120); }}
                      className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-mono font-bold"
                    >
                      SUMMER15 (15%)
                    </button>
                    <button
                      onClick={() => { setCouponCodeInput("WELCOME20"); setCouponSubtotalInput(100); }}
                      className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-mono font-bold"
                    >
                      WELCOME20 (20%)
                    </button>
                    <button
                      onClick={() => { setCouponCodeInput("VIP50"); setCouponSubtotalInput(180); }}
                      className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-mono font-bold"
                    >
                      VIP50 (₪50 קבוע)
                    </button>
                  </div>

                  {/* Coupon Validation Result Feedback */}
                  {couponFeedback && (
                    <div
                      className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                        couponFeedback.valid
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-rose-50 border-rose-300 text-rose-800"
                      }`}
                    >
                      {couponFeedback.valid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <div>{couponFeedback.message}</div>
                    </div>
                  )}
                </div>

                {/* 2B: Promotion Rule Engine Simulator */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Percent className="w-5 h-5 text-emerald-600" />
                      <h2 className="text-base font-bold text-primary">סימולטור מנוע מבצעים דטרמיניסטי</h2>
                    </div>
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">BEST_DEAL / Stacking</span>
                  </div>

                  {/* Simulator Toggles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <button
                      onClick={() => setSimProfile((p) => ({ ...p, isFirstOrder: !p.isFirstOrder }))}
                      className={`p-2 rounded-lg font-bold border transition-colors ${
                        simProfile.isFirstOrder
                          ? "bg-emerald-600 text-white border-emerald-700"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {simProfile.isFirstOrder ? "✓ הזמנה ראשונה" : "הזמנה חוזרת"}
                    </button>
                    <button
                      onClick={() => setSimProfile((p) => ({ ...p, isVip: !p.isVip }))}
                      className={`p-2 rounded-lg font-bold border transition-colors ${
                        simProfile.isVip
                          ? "bg-purple-600 text-white border-purple-700"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {simProfile.isVip ? "✓ לקוח VIP" : "לקוח רגיל"}
                    </button>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={simProfile.orderSubtotal}
                        onChange={(e) => setSimProfile((p) => ({ ...p, orderSubtotal: Number(e.target.value) }))}
                        className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono font-bold"
                        placeholder="סכום הזמנה ב-₪"
                      />
                    </div>
                  </div>

                  {/* Live Simulation Output */}
                  {(() => {
                    let discount = 0;
                    let ruleApplied = "";
                    let explanation = "";

                    if (simProfile.isFirstOrder && simProfile.orderSubtotal >= 60) {
                      discount = Math.min(simProfile.orderSubtotal * 0.2, 40);
                      ruleApplied = "הטבת הזמנה ראשונה בווב (20% עד ₪40)";
                      explanation = `הלקוח זכאי להטבת לקוח חדש לפי היסטוריית הזמנות. חושב חיסכון של ₪${discount.toFixed(2)}.`;
                    } else if (simProfile.isVip && simProfile.orderSubtotal >= 100) {
                      discount = 25;
                      ruleApplied = "הטבת חבר VIP בלעדית (₪25 הנחה קבועה)";
                      explanation = `הלקוח זוהה כ-לקוח VIP במועדון. הוחלה הנחת נאמנות קבועה של ₪25.00.`;
                    } else {
                      discount = 0;
                      ruleApplied = "לא הוחלו מבצעים";
                      explanation = "ההזמנה אינה עומדת בתנאי סף סכום מינימום או זכאות הלקוח.";
                    }

                    return (
                      <div className="bg-emerald-50/60 p-3.5 rounded-lg border border-emerald-200 text-xs space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-emerald-900">{ruleApplied}</span>
                          <span className="font-mono font-black text-sm text-emerald-700">חיסכון: ₪{discount.toFixed(2)}</span>
                        </div>
                        <p className="text-[11px] text-gray-600">{explanation}</p>
                      </div>
                    );
                  })()}
                </div>
              </section>
            </div>

            {/* Bottom Full-Width Section: Campaigns & Multi-Channel Dispatch */}
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-pink-600" />
                  <div>
                    <h2 className="text-base font-bold text-primary">לוח קמפיינים ושיגור רב-ערוצי (SMS, WhatsApp, Email)</h2>
                    <p className="text-xs text-gray-500">
                      ניהול קמפיינים ממוקדים לפי סגמנטים, תקציב, מדדי המרה ומעקב ROI.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-pink-50 text-pink-700 border border-pink-200">
                  {campaigns.length} קמפיינים מנוהלים
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3">שם הקמפיין</th>
                      <th className="p-3">סוג</th>
                      <th className="p-3">סטטוס</th>
                      <th className="p-3">ערוצים</th>
                      <th className="p-3">תקציב שנוצל</th>
                      <th className="p-3">נשלחו / המרות</th>
                      <th className="p-3 text-left">פעולה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {campaigns.map((camp) => (
                      <tr key={camp.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-gray-900">{camp.name}</div>
                          <div className="text-gray-400 text-[11px] font-mono">{camp.id}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">
                            {camp.type}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              camp.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : camp.status === "SCHEDULED"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {camp.status === "ACTIVE" ? "פעיל" : camp.status === "SCHEDULED" ? "מתוזמן" : "טיוטה"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {camp.channels.map((ch) => (
                              <span key={ch} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-bold">
                                {ch}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 font-mono">
                          <div>₪{camp.budgetSpent.toLocaleString()} / ₪{camp.budgetLimit.toLocaleString()}</div>
                          <div className="w-24 bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-primary h-full"
                              style={{ width: `${Math.min(100, (camp.budgetSpent / camp.budgetLimit) * 100)}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="p-3 font-mono">
                          <div className="font-bold text-gray-800">{camp.sentCount.toLocaleString()} נשלחו</div>
                          <div className="text-emerald-600 text-[11px]">{camp.conversions} המרות ({camp.sentCount > 0 ? ((camp.conversions / camp.sentCount) * 100).toFixed(1) : 0}%)</div>
                        </td>
                        <td className="p-3 text-left">
                          <button
                            onClick={() => handleDispatchCampaign(camp.id)}
                            className="inline-flex items-center gap-1.5 bg-primary hover:bg-gray-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>שגר כעת</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 7: TELEPHONY (PHASE 7) */}
        {activeTab === "telephony" && (
          <div className="space-y-6">
            {/* Header & Simulator Bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Phase 7 — VoIP / SIP Integration
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      הודעת פתיחה אוטומטית מופעלת (חוק ישראלי)
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-primary">מערך טלפוניה, PBX וקפיצת פרטי מתקשר (Caller ID)</h2>
                  <p className="text-sm text-gray-600">
                    זיהוי מיידי של לקוחות מחייגים, היסטוריית הזמנות, כתובות שמורות והתחלת הזמנה טלפונית בקליק.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-mono">
                    <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                    <span>מתאם SIP: פעיל (Mock)</span>
                  </div>
                </div>
              </div>

              {/* Simulation triggers */}
              <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-gray-700">סימולציית שיחה נכנסת (בדיקה):</span>
                <button
                  onClick={() => triggerSimulatedCall(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  <PhoneIncoming className="w-3.5 h-3.5" />
                  <span>שיחה מלקוח VIP קיים (052-4455667)</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={simPhoneNumber}
                    onChange={(e) => setSimPhoneNumber(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-mono text-gray-800 w-32 text-center"
                    placeholder="05X-XXXXXXX"
                  />
                  <button
                    onClick={() => triggerSimulatedCall(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition-colors border border-gray-300"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-gray-600" />
                    <span>שיחה מלקוח חדש</span>
                  </button>
                </div>

                {activeCall && (
                  <button
                    onClick={() => setActiveCall(null)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-auto font-medium"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>סגור פופאפ</span>
                  </button>
                )}
              </div>
            </div>

            {/* CALLER ID POPUP (DEMO) */}
            {activeCall && (
              <section className="bg-white rounded-xl border-2 border-amber-400 p-6 shadow-lg relative overflow-hidden transition-all animate-in fade-in slide-in-from-top-2">
                <div className="absolute top-0 right-0 left-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold px-4 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                    </span>
                    <span>שיחה נכנסת בזמן אמת (Session: {activeCall.sessionId})</span>
                  </div>
                  <span className="bg-white/20 px-2 py-0.5 rounded font-mono">מזהה קו: 03-5550100</span>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left/Col 1: Customer Profile */}
                  <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/60">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs text-amber-800 font-bold uppercase tracking-wider">מספר מחייג:</span>
                        <div className="text-2xl font-black text-gray-900 font-mono tracking-tight mt-0.5">
                          {activeCall.callerNumber}
                        </div>
                      </div>
                      {activeCall.customer?.isVip && (
                        <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-300">
                          ⭐ לקוח VIP
                        </span>
                      )}
                    </div>

                    {activeCall.customer ? (
                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="text-xs text-gray-500">שם הלקוח ב-CRM:</div>
                          <div className="text-base font-bold text-gray-800">{activeCall.customer.name}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/40 text-xs">
                          <div>
                            <span className="text-gray-500">סה"כ הזמנות:</span>
                            <div className="font-bold text-gray-900 font-mono">{activeCall.customer.totalOrders}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">סך רכישות מצטבר:</span>
                            <div className="font-bold text-gray-900 font-mono">₪{activeCall.customer.totalSpent.toLocaleString()}</div>
                          </div>
                        </div>

                        {activeCall.customer.allergies.length > 0 && (
                          <div className="pt-2 border-t border-amber-200/40">
                            <span className="text-xs font-bold text-rose-700">אלרגיות רשומות:</span>
                            <div className="flex gap-1 mt-1">
                              {activeCall.customer.allergies.map((all, i) => (
                                <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-800 text-xs rounded-full font-bold">
                                  ⚠️ {all}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeCall.customer.notes && (
                          <div className="pt-2 border-t border-amber-200/40 text-xs text-gray-600 bg-white/70 p-2.5 rounded-lg border border-gray-200">
                            <span className="font-bold text-gray-800">הערות פנימיות:</span>
                            <p className="mt-0.5 italic">{activeCall.customer.notes}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 p-4 bg-white/80 rounded-lg border border-dashed border-gray-300 text-center">
                        <UserCheck className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs font-bold text-gray-700">לקוח חדש (אינו קיים במאגר)</p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          הפרטים יישמרו אוטומטית בעת ביצוע הזמנה טלפונית ראשונה.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Mid/Col 2: Saved Addresses & Recent Orders */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        כתובות שמורות למשלוח:
                      </h4>
                      {activeCall.addresses.length > 0 ? (
                        <div className="space-y-2">
                          {activeCall.addresses.map((addr) => (
                            <div
                              key={addr.id}
                              className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs hover:border-primary cursor-pointer transition-colors"
                            >
                              <div className="font-bold text-gray-900">{addr.address}</div>
                              {addr.isDefault && (
                                <span className="inline-block mt-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                                  כתובת ברירת מחדל
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">
                          אין כתובות רשומות
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        הזמנות אחרונות:
                      </h4>
                      {activeCall.recentOrders.length > 0 ? (
                        <div className="space-y-2">
                          {activeCall.recentOrders.map((ord) => (
                            <div key={ord.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                              <div className="flex justify-between items-center font-bold">
                                <span className="font-mono text-gray-900">{ord.id}</span>
                                <span className="text-gray-900 font-mono">₪{ord.total}</span>
                              </div>
                              <div className="text-gray-600 mt-1">{ord.summary}</div>
                              <div className="text-[10px] text-gray-400 mt-1">{ord.date}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">
                          אין הזמנות קודמות
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right/Col 3: Operator Actions */}
                  <div className="flex flex-col justify-between bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        פעולות מוקדן / קופאי:
                      </h4>
                      <p className="text-xs text-gray-600 mb-4">
                        מענה לשיחה ייקשר ישירות למסך יצירת ההזמנה עם ערוץ <code>PHONE</code> ופרטי הלקוח מוזנים מראש.
                      </p>

                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            if (activeCall) {
                              const newOrderId = `ORD-${Math.floor(1044 + Math.random() * 50)}`;
                              const customerLabel = activeCall.customer
                                ? `${activeCall.customer.name} (${activeCall.callerNumber})`
                                : `לקוח חדש (${activeCall.callerNumber})`;

                              const newPhoneOrder = {
                                id: newOrderId,
                                channel: "PHONE",
                                channelLabel: "טלפון (Phone)",
                                channelBg: "bg-amber-50 text-amber-800 border-amber-200",
                                customer: customerLabel,
                                isVip: activeCall.customer?.isVip || false,
                                items: activeCall.recentOrders.length > 0
                                  ? `${activeCall.recentOrders[0].summary} (שכפול)`
                                  : "הזמנה טלפונית חדשה — בהזנה",
                                total: activeCall.recentOrders.length > 0 ? activeCall.recentOrders[0].total : 95.00,
                                status: "CONFIRMED" as OrderStatus,
                              };

                              setOrdersList((prev) => [newPhoneOrder, ...prev]);

                              // Record in call history as ANSWERED
                              setCallHistory((prev) => [
                                {
                                  id: `log-${Date.now()}`,
                                  caller: activeCall.callerNumber,
                                  name: activeCall.customer?.name || "לקוח לא מזוהה",
                                  duration: "00:30",
                                  status: "COMPLETED",
                                  time: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
                                  greeting: true,
                                },
                                ...prev,
                              ]);
                            }

                            setActiveCall((prev) => (prev ? { ...prev, status: "ANSWERED" } : null));
                            setActiveTab("orders");
                          }}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                        >
                          <PhoneCall className="w-4 h-4" />
                          <span>ענה לשיחה ופתח הזמנה טלפונית (Auto-Intake)</span>
                        </button>

                        <button
                          onClick={() => {
                            if (activeCall) {
                              setCallHistory((prev) => [
                                {
                                  id: `log-${Date.now()}`,
                                  caller: activeCall.callerNumber,
                                  name: activeCall.customer?.name || "לקוח לא מזוהה",
                                  duration: "00:00",
                                  status: "REJECTED",
                                  time: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
                                  greeting: true,
                                },
                                ...prev,
                              ]);
                            }
                            setActiveCall(null);
                          }}
                          className="w-full py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          <PhoneOff className="w-3.5 h-3.5" />
                          <span>דחה שיחה</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 mt-4 text-[11px] text-gray-500 flex items-center justify-between">
                      <span>הודעת הקלטה: הושמעה כחוק</span>
                      <span className="font-mono text-emerald-600 font-bold">200 OK</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Call History Table */}
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-primary mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                יומן שיחות אחרונות (Call Logs)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                    <tr>
                      <th className="p-3">שעה</th>
                      <th className="p-3">מספר מחייג</th>
                      <th className="p-3">שם לקוח מזוהה</th>
                      <th className="p-3">משך שיחה</th>
                      <th className="p-3">סטטוס</th>
                      <th className="p-3">הודעת פתיחה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {callHistory.map((call) => (
                      <tr key={call.id} className="hover:bg-gray-50/50">
                        <td className="p-3 font-mono text-gray-500">{call.time}</td>
                        <td className="p-3 font-mono font-bold text-gray-900">{call.caller}</td>
                        <td className="p-3 font-medium text-gray-800">{call.name}</td>
                        <td className="p-3 font-mono">{call.duration}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              call.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : call.status === "MISSED"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {call.status === "COMPLETED" ? "הושלמה" : call.status === "MISSED" ? "לא נענתה" : "נדחתה"}
                          </span>
                        </td>
                        <td className="p-3 text-emerald-600 text-xs">
                          {call.greeting ? "✓ הושמעה (חוק ישראלי)" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 8: INTEGRATIONS HUB */}
        {activeTab === "integrations" && (
          <div className="space-y-6">
            {/* Toast Notification */}
            {integrationToast && (
              <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-bold animate-bounce">
                {integrationToast}
              </div>
            )}

            {/* Provider Status Grid */}
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Plug className="w-5 h-5 text-cyan-600" />
                  ספקי אינטגרציה (Integration Providers)
                </h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {integrationProviders.filter((p) => p.status === "CONNECTED").length}/{integrationProviders.length} מחוברים
                </span>
              </div>

              {/* Aggregators */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    אגרגטורי הזמנות (Sales Aggregators)
                  </h3>
                  <span className="text-[11px] text-gray-400">לחץ על כרטיס לשליחת Webhook בדיקה</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {integrationProviders.filter((p) => p.type === "AGGREGATOR").map((provider) => (
                    <div
                      key={provider.id}
                      onClick={() => simulateWebhook(provider.name)}
                      role="button"
                      tabIndex={0}
                      className="p-4 rounded-xl border border-gray-200 hover:border-sky-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer bg-white flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl p-1.5 rounded-lg bg-gray-50 border border-gray-100">{provider.icon}</span>
                            <div>
                              <p className="text-sm font-extrabold text-gray-900 group-hover:text-sky-700 transition-colors">{provider.name}</p>
                              <p className="text-[11px] text-gray-500">{provider.nameHe}</p>
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            provider.status === "CONNECTED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-gray-100 text-gray-500 border border-gray-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              provider.status === "CONNECTED" ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                            }`} />
                            {provider.status === "CONNECTED" ? "מחובר" : "המתנה"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-1 border-t border-gray-100">
                          <span className="text-gray-500">הזמנות היום: <strong className="text-gray-900">{provider.ordersToday}</strong></span>
                          <span className="text-gray-400 font-mono text-[11px]">{provider.lastSync}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          simulateWebhook(provider.name);
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-xs font-bold text-sky-800 transition-colors border border-sky-200 shadow-sm"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        שלח Webhook לדוגמה (Simulate)
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoicing */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    חשבונית אלקטרונית (E-Invoicing)
                  </h3>
                  <span className="text-[11px] text-gray-400">לחץ להפקת חשבונית מס קבלה</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {integrationProviders.filter((p) => p.type === "INVOICING").map((provider) => (
                    <div
                      key={provider.id}
                      onClick={() => simulateInvoice(provider.name)}
                      role="button"
                      tabIndex={0}
                      className="p-4 rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer bg-white flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl p-1.5 rounded-lg bg-gray-50 border border-gray-100">{provider.icon}</span>
                            <div>
                              <p className="text-sm font-extrabold text-gray-900 group-hover:text-emerald-700 transition-colors">{provider.name}</p>
                              <p className="text-[11px] text-gray-500">{provider.nameHe}</p>
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            provider.status === "CONNECTED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-gray-100 text-gray-500 border border-gray-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              provider.status === "CONNECTED" ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                            }`} />
                            {provider.status === "CONNECTED" ? "מחובר" : "המתנה"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-1 border-t border-gray-100">
                          <span className="text-gray-500">חשבוניות היום: <strong className="text-gray-900">{(provider as any).invoicesToday ?? 0}</strong></span>
                          <span className="text-gray-400 font-mono text-[11px]">{provider.lastSync}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          simulateInvoice(provider.name);
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 transition-colors border border-emerald-200 shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        הפק חשבונית בדיקה
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payments */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    סליקה ותשלומים (Payment Gateways)
                  </h3>
                  <span className="text-[11px] text-gray-400">לחץ לביצוע עסקת סליקה לדוגמה</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {integrationProviders.filter((p) => p.type === "PAYMENT").map((provider) => (
                    <div
                      key={provider.id}
                      onClick={() => simulatePayment(provider.name)}
                      role="button"
                      tabIndex={0}
                      className="p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer bg-white flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl p-1.5 rounded-lg bg-gray-50 border border-gray-100">{provider.icon}</span>
                            <div>
                              <p className="text-sm font-extrabold text-gray-900 group-hover:text-blue-700 transition-colors">{provider.name}</p>
                              <p className="text-[11px] text-gray-500">{provider.nameHe}</p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            מחובר
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-1 border-t border-gray-100">
                          <span className="text-gray-500">עסקאות היום: <strong className="text-gray-900">{(provider as any).txToday ?? 0}</strong></span>
                          <span className="text-gray-400 font-mono text-[11px]">{provider.lastSync}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          simulatePayment(provider.name);
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-800 transition-colors border border-blue-200 shadow-sm"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        בצע סליקת בדיקה
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 10-Step Pipeline Visualization */}
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  פייפליין 10-שלבי מנורמל (Normalized Ingestion Pipeline)
                </h2>
                <span className="text-xs text-gray-500">לחץ על שלב לצפייה בפרטים טכניים מלאים</span>
              </div>

              {/* Steps Grid - Fully Responsive */}
              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 pt-1">
                {[
                  { step: 1, label: "קבלת Webhook", icon: "📥" },
                  { step: 2, label: "אימות HMAC", icon: "🔐" },
                  { step: 3, label: "בדיקת Timestamp", icon: "⏱️" },
                  { step: 4, label: "Idempotency", icon: "🔒" },
                  { step: 5, label: "Transform DTO", icon: "🔄" },
                  { step: 6, label: "Canonical DTO", icon: "📋" },
                  { step: 7, label: "Zod Validation", icon: "✅" },
                  { step: 8, label: "שמירה ב-DB", icon: "💾" },
                  { step: 9, label: "Outbox Event", icon: "📤" },
                  { step: 10, label: "Realtime Sync", icon: "⚡" },
                ].map((s) => {
                  const isSelected = selectedPipelineStep === s.step;
                  return (
                    <div
                      key={s.step}
                      onClick={() => setSelectedPipelineStep(isSelected ? null : s.step)}
                      role="button"
                      tabIndex={0}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer select-none active:scale-95 ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400 shadow-md"
                          : "bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300"
                      }`}
                    >
                      <span className="text-xl">{s.icon}</span>
                      <span className={`text-[11px] font-bold text-center leading-tight ${isSelected ? "text-white" : "text-emerald-900"}`}>
                        {s.label}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                        isSelected ? "bg-emerald-700 text-emerald-100" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        Step {s.step}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Expanded Step Detail Box */}
              {selectedPipelineStep !== null && PIPELINE_STEP_DETAILS[selectedPipelineStep] && (
                <div className="p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50/90 shadow-sm space-y-2 mt-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{PIPELINE_STEP_DETAILS[selectedPipelineStep].icon}</span>
                      <div>
                        <h4 className="text-sm font-black text-emerald-950">
                          Step {selectedPipelineStep}: {PIPELINE_STEP_DETAILS[selectedPipelineStep].title}
                        </h4>
                        <p className="text-[11px] font-bold text-emerald-700 font-mono">
                          {PIPELINE_STEP_DETAILS[selectedPipelineStep].subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-200 text-emerald-900 border border-emerald-300 font-mono">
                        {PIPELINE_STEP_DETAILS[selectedPipelineStep].status}
                      </span>
                      <button
                        onClick={() => setSelectedPipelineStep(null)}
                        className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 bg-white rounded border border-gray-200 font-bold"
                      >
                        ✕ סגור
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-800 leading-relaxed">
                    {PIPELINE_STEP_DETAILS[selectedPipelineStep].desc}
                  </p>
                  <p className="text-[11px] text-emerald-800 font-medium bg-white/70 p-2 rounded border border-emerald-200">
                    💡 <strong>פרט מימוש:</strong> {PIPELINE_STEP_DETAILS[selectedPipelineStep].detail}
                  </p>
                </div>
              )}
            </section>

            {/* Webhook Activity Log */}
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-violet-600" />
                  יומן Webhooks נכנסים (Inbound Webhook Log)
                </h2>
                <span className="text-xs font-mono text-gray-400">{webhookLog.length} אירועים אחרונים</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs font-bold">
                      <th className="p-3 text-right">שעה</th>
                      <th className="p-3 text-right">ספק</th>
                      <th className="p-3 text-right">אירוע</th>
                      <th className="p-3 text-right">מזהה</th>
                      <th className="p-3 text-right">סכום</th>
                      <th className="p-3 text-right">פייפליין</th>
                      <th className="p-3 text-right">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {webhookLog.map((wh) => (
                      <tr key={wh.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 font-mono text-gray-500 text-xs">{wh.timestamp}</td>
                        <td className="p-3 font-bold text-gray-900 text-xs">{wh.provider}</td>
                        <td className="p-3 font-mono text-gray-600 text-xs">{wh.eventType}</td>
                        <td className="p-3 font-mono font-bold text-gray-800 text-xs">{wh.orderId}</td>
                        <td className="p-3 font-mono text-gray-700 text-xs tabular-nums">₪{wh.amount.toFixed(2)}</td>
                        <td className="p-3 font-mono text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            wh.pipeline === "10/10" ? "bg-emerald-50 text-emerald-700" : wh.pipeline === "4/10" ? "bg-amber-50 text-amber-700" : "text-gray-400"
                          }`}>
                            {wh.pipeline}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            wh.status === "SUCCESS"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : wh.status === "DUPLICATE"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {wh.status === "SUCCESS" ? "הצלחה" : wh.status === "DUPLICATE" ? "כפילות" : "שגיאה"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Retry Queue & Dead Letters */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Retry Queue */}
              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
                  <h2 className="text-base font-bold text-primary flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    תור ניסיונות חוזרים (Retry Queue)
                  </h2>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    retryQueue.length > 0
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}>
                    {retryQueue.length} בתור
                  </span>
                </div>
                {retryQueue.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm font-bold">אין משימות ממתינות</p>
                    <p className="text-xs text-gray-400 mt-1">כל הניסיונות החוזרים הושלמו בהצלחה</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {retryQueue.map((r) => (
                      <div key={r.id} className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/60 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-900">{r.provider} — {r.eventType}</span>
                          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            ניסיון {r.attempt}/{r.maxAttempts}
                          </span>
                        </div>
                        <div className="w-full bg-amber-200 rounded-full h-1.5">
                          <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${(r.attempt / r.maxAttempts) * 100}%` }} />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <p className="text-[10px] text-amber-700">
                            ניסיון הבא: {r.nextRetry} (Exponential Backoff: {Math.pow(2, r.attempt - 1)}s)
                          </p>
                          <button
                            onClick={() => processRetryNow(r.id)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition-colors"
                          >
                            נסה עכשיו (Retry Now)
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Dead Letter Queue */}
              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
                  <h2 className="text-base font-bold text-primary flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-rose-600" />
                    Dead-Letter Queue (הודעות שנכשלו)
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={simulateDeadLetter}
                      className="text-[11px] font-bold px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors"
                    >
                      + הדמה שגיאה (DLQ)
                    </button>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      deadLetters.length > 0
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}>
                      {deadLetters.length} הודעות
                    </span>
                  </div>
                </div>
                {deadLetters.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm font-bold">אין הודעות שנכשלו 🎉</p>
                    <p className="text-xs text-gray-400 mt-1">כל ה-Webhooks עובדו בהצלחה. לחץ "+ הדמה שגיאה" לבדיקת Replay</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {deadLetters.map((dl) => (
                      <div key={dl.id} className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/60 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-rose-900">{dl.provider} — {dl.eventType}</span>
                            <span className="text-[10px] font-mono text-gray-400">{dl.failedAt}</span>
                          </div>
                          <p className="text-[11px] text-rose-700 mt-0.5">{dl.reason}</p>
                        </div>
                        <button
                          onClick={() => replayDeadLetter(dl.id)}
                          className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-colors shrink-0 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Replay
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Integration Security & Architecture Summary */}
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  אבטחת אינטגרציות ואדריכלות (Security & Architecture)
                </h2>
                <span className="text-xs text-gray-400">לחץ על כרטיס למידע מורחב</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => setIntegrationToast("🔐 HMAC-SHA256: אימות חתימה קריפטוגרפית ב-constant time, מניעת זיוף בקשות והגנה על Webhooks נכנסים")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-blue-50/50 hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-extrabold text-gray-800 group-hover:text-blue-700">HMAC-SHA256</span>
                    </div>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-[-2px] transition-all" />
                  </div>
                  <p className="text-[11px] text-gray-600">חתימה קריפטוגרפית constant-time על כל Webhook נכנס. מניעת זיוף הודעות.</p>
                </div>

                <div
                  onClick={() => setIntegrationToast("⏱️ Replay Protection: חלון קבוע של 300 שניות (5 דקות) ביחס ל-Timestamp השרת")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-amber-50/50 hover:border-amber-300 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-extrabold text-gray-800 group-hover:text-amber-700">Replay Protection</span>
                    </div>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-600 group-hover:translate-x-[-2px] transition-all" />
                  </div>
                  <p className="text-[11px] text-gray-600">חלון 5 דקות (300 שניות) — בקשות ישנות נדחות. מניעת התקפות Replay.</p>
                </div>

                <div
                  onClick={() => setIntegrationToast("🔒 Idempotency: מפתח מבוזר ב-Redis עם SETNX ל-60 שניות ומטמון ל-24 שעות למניעת כפילויות")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-purple-50/50 hover:border-purple-300 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-extrabold text-gray-800 group-hover:text-purple-700">Idempotency</span>
                    </div>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-600 group-hover:translate-x-[-2px] transition-all" />
                  </div>
                  <p className="text-[11px] text-gray-600">Redis Lock + Cache (24 שעות). מניעת כפילויות הזמנות, חיובים וחשבוניות.</p>
                </div>

                <div
                  onClick={() => setIntegrationToast("✨ Canonical DTOs: שכבת נירמול אחידה עם סכמת Zod, המונעת דליפת מודל ספק ל-Domain")}
                  role="button"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-cyan-50/50 hover:border-cyan-300 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-600" />
                      <span className="text-xs font-extrabold text-gray-800 group-hover:text-cyan-700">Canonical DTOs</span>
                    </div>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-cyan-600 group-hover:translate-x-[-2px] transition-all" />
                  </div>
                  <p className="text-[11px] text-gray-600">Universal DTO + Zod Validation. פורמט ספק חיצוני לעולם לא דולף ל-Domain.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 9: STOREFRONT & KIOSK (Phase 9) */}
        {activeTab === "storefront" && (
          <div className="space-y-6">
            {/* Quick Launch Banner */}
            <section className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-850 border border-zinc-800 rounded-2xl p-6 shadow-xl text-white">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-zinc-950">
                      PHASE 9 COMPLETED
                    </span>
                    <span className="text-xs text-zinc-400 font-bold">
                      ערוצי הזמנה ישירים • ללא עמלות ספקים
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    אתר הזמנות לציבור ועמדות קיוסק עצמאיות
                  </h2>
                  <p className="text-sm text-zinc-300 mt-1 max-w-2xl">
                    פלטפורמת הזמנות ציבורית מותאמת מובייל ו-SEO (Next.js SSR) לצד ממשק קיוסק טאץ' מהיר
                    במסעדה, המחוברים ישירות למנוע ההזמנות האוניברסלי, KDS, סליקת Meshulam/Stripe וניהול שליחים.
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full lg:w-auto">
                  <a
                    href="/r/israeli-burgers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial px-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Globe className="w-4 h-4" />
                    <span>פתח אתר לקוחות (/r/...)</span>
                  </a>
                  <a
                    href="/kiosk/be7c3e30-b28b-4d23-9d78-b56b545351f5"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial px-5 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm border border-zinc-700 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Monitor className="w-4 h-4 text-amber-400" />
                    <span>פתח מצב קיוסק (/kiosk/...)</span>
                  </a>
                </div>
              </div>
            </section>

            {/* Architecture Highlights & Metrics */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase">
                  <span>ערוץ אתר (Web Storefront)</span>
                  <Smartphone className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-gray-900">Next.js 15 SSR</div>
                <p className="text-xs text-gray-500">
                  טעינה מהירה, Schema.org Restaurant/Menu JSON-LD, מטא-טאגים, וממשק עברית/אנגלית (RTL/LTR).
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase">
                  <span>עמדת קיוסק (Kiosk POS)</span>
                  <Monitor className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-gray-900">Touch Inactivity 120s</div>
                <p className="text-xs text-gray-500">
                  טאץ' 64px+, שדרוגים דטרמיניסטיים, איפוס אוטומטי בהיעדר מגע, והדמיית מסוף אשראי EMV.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase">
                  <span>אבטחת מחירים</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-gray-900">Server-Authoritative</div>
                <p className="text-xs text-gray-500">
                  חישוב מחירים בצד שרת בלבד, מניעת מניפולציות מחיר, בדיקת קופונים וחסימת Rate Limit.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase">
                  <span>מעקב הזמנות חי</span>
                  <Bike className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-2xl font-black text-gray-900">Live GPS Telemetry</div>
                <p className="text-xs text-gray-500">
                  בר התקדמות בזמן אמת, מפת ניטור שליח בתנועה, חישוב SLA וזמני הגעה משוערים.
                </p>
              </div>
            </section>

            {/* Public Ordering Channels Status & Direct Links Table */}
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-gray-900">ערוצי הזמנה פעילים ומסלולי URL</h3>
                  <p className="text-xs text-gray-500">קישורים ישירים לכל ערוצי הציבור והמסופים</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  2 ערוצים מחוברים (WEB + KIOSK)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="p-3 font-bold">ערוץ / יעד</th>
                      <th className="p-3 font-bold">כתובת URL (Slug Routing)</th>
                      <th className="p-3 font-bold">מצב אבטחה / אינדוקס</th>
                      <th className="p-3 font-bold">אמצעי תשלום נתמכים</th>
                      <th className="p-3 font-bold text-left">פעולה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-900 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-600" />
                        <span>אתר לקוחות (Storefront)</span>
                      </td>
                      <td className="p-3 font-mono text-gray-600">/r/israeli-burgers</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          SEO Indexable + JSON-LD
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">כרטיס אשראי אונליין, מזומן לשליח / בדלפק</td>
                      <td className="p-3 text-left">
                        <a
                          href="/r/israeli-burgers"
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition-colors inline-block"
                        >
                          פתח דף נחיתה ↗
                        </a>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-900 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-amber-600" />
                        <span>תפריט הזמנות מלא</span>
                      </td>
                      <td className="p-3 font-mono text-gray-600">/r/israeli-burgers/menu</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          CDN Caching + Zod Validation
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">סל קניות אינטראקטיבי + קופונים (Phase 6)</td>
                      <td className="p-3 text-left">
                        <a
                          href="/r/israeli-burgers/menu"
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold transition-colors inline-block"
                        >
                          צפה בתפריט ↗
                        </a>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-900 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-purple-600" />
                        <span>עמדת קיוסק סניף ראשי</span>
                      </td>
                      <td className="p-3 font-mono text-gray-600">/kiosk/be7c3e30-b28b-4d23-9d78-b56b545351f5</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
                          noindex (מסוף פנימי)
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">מסוף אשראי EMV + תשלום בקופה</td>
                      <td className="p-3 text-left">
                        <a
                          href="/kiosk/be7c3e30-b28b-4d23-9d78-b56b545351f5"
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold transition-colors inline-block"
                        >
                          הפעל קיוסק ↗
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-gray-500 pt-6 pb-2 border-t border-gray-200">
          <p>RestaurantOS Architecture & Development Platform © 2026 ShorTech. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
