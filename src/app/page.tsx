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
} from "lucide-react";
import { StatusBadge, OrderStatus } from "@/components/ui/status-badge";

type ActiveTab = "overview" | "orders" | "kds" | "delivery" | "inventory";

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

  // Sample Driver Queue state
  const [driverQueue, setDriverQueue] = useState([
    { position: 1, name: "דני כהן (Dan)", id: "usr-02-driver", status: "ON_SHIFT", assignment: "AVAILABLE", availableSince: "לפני 25 דקות", vehicle: "קטנוע Kymco 125" },
    { position: 2, name: "יוסי לוי (Yossi)", id: "usr-03-driver", status: "ON_SHIFT", assignment: "AVAILABLE", availableSince: "לפני 12 דקות", vehicle: "יונדאי i10" },
    { position: 3, name: "רונן אלון (Ronen)", id: "usr-04-driver", status: "BREAK", assignment: "UNAVAILABLE", availableSince: "בהפסקה", vehicle: "אופניים חשמליים" },
  ]);

  // Sample Batch Recommendation state
  const [batchActionStatus, setBatchActionStatus] = useState<string | null>(null);

  const bumpTicket = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: t.status === "READY" ? "COMPLETED" : "READY" } : t))
    );
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
          </nav>
        </header>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Multi-Tenancy</h3>
                  <p className="text-xl font-black text-primary mt-0.5">Org / Branch</p>
                  <p className="text-xs text-gray-500 mt-1">בידוד PostgreSQL RLS מלא</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Authentication</h3>
                  <p className="text-xl font-black text-primary mt-0.5">RBAC (12 Roles)</p>
                  <p className="text-xs text-gray-500 mt-1">עוגיות HttpOnly + PIN מהיר</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit & Outbox</h3>
                  <p className="text-xl font-black text-primary mt-0.5">Transactional</p>
                  <p className="text-xs text-gray-500 mt-1">100% Immutable Event Ledger</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Realtime Mesh</h3>
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
                  שלבים 1 עד 4 הושלמו בהצלחה
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-800">Phase 1: Foundation</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">אבטחה, אימות ו-Outbox</p>
                  <p className="text-xs text-gray-600">
                    בידוד ארגוני, טוקנים מאובטחים, Rate Limiter, ואימות Webhooks בחתימת HMAC-SHA256.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-800">Phase 2: CRM & Orders</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">הזמנות אוניברסליות ותפריט</p>
                  <p className="text-xs text-gray-600">
                    מנוע הזמנות עמיד, ניהול מודולרי של תוספות ומידות עשייה, וכרטיס לקוח VIP.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-800">Phase 3: KDS</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">מסילות כרטיסים ו-SLA</p>
                  <p className="text-xs text-gray-600">
                    ניתוב פריטים לפי תחנות עבודה (המבורגר, צ'יפס, שתייה), ניטור זמנים ויזואלי והתראות חריגה.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-800">Phase 4: Delivery & Fleet</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">משלוחים, תור FIFO ואיחוד חכם</p>
                  <p className="text-xs text-gray-600">
                    מודל נהג 3-ממדי, שיוך עצמי מוגן קונפליקטים (409), טלמטריה וגאופנס 150מ' מייעץ.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-blue-300 bg-blue-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-blue-800">Phase 5: Inventory & BOM</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">השלב הבא</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">מלאי, עצי מוצר וספקים</p>
                  <p className="text-xs text-gray-600">
                    מדיניות ניפוק מוגדרת (ON_ACCEPTED), המרת יחידות מידה, תנועות מלאי ומניעת מלאי שלילי.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-2 opacity-75">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600">Phase 6: Marketing & Loyalty</span>
                    <span className="text-xs font-medium text-gray-500">מתוכנן</span>
                  </div>
                  <p className="text-sm font-bold text-gray-700">קמפיינים, מועדון והטבות</p>
                  <p className="text-xs text-gray-500">
                    מנוע חוקים להנחות, צבירת נקודות חבר מועדון וסגמנטציה מתקדמת.
                  </p>
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
                    <tr className="hover:bg-gray-50/75">
                      <td className="p-3 font-bold text-primary">ORD-1042</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">משלוח (Delivery)</span>
                      </td>
                      <td className="p-3 font-medium">עומר לוי (050-7776655)</td>
                      <td className="p-3 text-gray-700">המבורגר שורטק (M) + צ'יפס</td>
                      <td className="p-3 font-bold tabular-nums">₪87.00</td>
                      <td className="p-3">
                        <StatusBadge status="IN_PREPARATION" />
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/75">
                      <td className="p-3 font-bold text-primary">ORD-1041</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">ישיבה (Dine-In T-4)</span>
                      </td>
                      <td className="p-3 font-medium">דני כהן (VIP)</td>
                      <td className="p-3 text-gray-700">2x דאבל בורגר + 2x קולה</td>
                      <td className="p-3 font-bold tabular-nums">₪168.00</td>
                      <td className="p-3">
                        <StatusBadge status="READY" />
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/75">
                      <td className="p-3 font-bold text-primary">ORD-1040</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">איסוף (Takeaway)</span>
                      </td>
                      <td className="p-3 font-medium">מיכל אברהם</td>
                      <td className="p-3 text-gray-700">המבורגר טבעוני + טבעות בצל</td>
                      <td className="p-3 font-bold tabular-nums">₪64.00</td>
                      <td className="p-3">
                        <StatusBadge status="DELIVERED" />
                      </td>
                    </tr>
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

        {/* Footer */}
        <footer className="text-center text-xs text-gray-500 pt-6 pb-2 border-t border-gray-200">
          <p>RestaurantOS Architecture & Development Platform © 2026 ShorTech. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
