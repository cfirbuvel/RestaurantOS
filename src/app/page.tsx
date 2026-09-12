import React from "react";
import { StatusBadge, OrderStatus } from "@/components/ui/status-badge";
import { ShieldCheck, Server, Database, Lock, Radio } from "lucide-react";

export default function HomePage() {
  const statuses: OrderStatus[] = [
    "NEW",
    "APPROVED",
    "IN_PREPARATION",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ];

  return (
    <main className="min-h-screen bg-surface p-6 sm:p-10 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <header className="border-b border-gray-200 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-container text-white mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                RestaurantOS — Phase 1: Production Foundation
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-primary">
                מערכת הפעלה למסעדות ורשתות מזון
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                מערך תשתית תפעולי רב-ארגוני, אבטחה קפדנית, ו-RBAC מבוסס תפקידים.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-gray-700">ליבת המערכת פעילה</span>
            </div>
          </div>
        </header>

        {/* Foundation Metrics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-md bg-blue-50 text-blue-600">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Multi-Tenancy</h3>
              <p className="text-lg font-bold text-primary mt-0.5">Org / Rest / Branch</p>
              <p className="text-xs text-gray-500 mt-1">בידוד RLS מלא ברמת מסד הנתונים</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-md bg-purple-50 text-purple-600">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Authentication</h3>
              <p className="text-lg font-bold text-primary mt-0.5">Cookies + PIN</p>
              <p className="text-xs text-gray-500 mt-1">עוגיות HttpOnly ונעילת טרמינל</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-md bg-amber-50 text-amber-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Outbox & Audit</h3>
              <p className="text-lg font-bold text-primary mt-0.5">Transactional</p>
              <p className="text-xs text-gray-500 mt-1">תיעוד Immutable והעברה ל-Pub/Sub</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-md bg-emerald-50 text-emerald-600">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Realtime Handshake</h3>
              <p className="text-lg font-bold text-primary mt-0.5">60s Single-Use</p>
              <p className="text-xs text-gray-500 mt-1">כרטיסי אימות מוגבלי זמן ב-Redis</p>
            </div>
          </div>
        </section>

        {/* Stitch Design System Preview */}
        <section className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-primary">סטטוסים תפעוליים (Stitch Tri-Factor Badges)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              שילוב של גוון רקע 10%, מסגרת 100%, אייקון ייעודי ותווית עברית חד-משמעית.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {statuses.map((st) => (
              <StatusBadge key={st} status={st} />
            ))}
          </div>
        </section>

        {/* API Health & Endpoints */}
        <section className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-primary mb-3">נקודות קצה פעילות (Foundation API v1)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Endpoint</th>
                  <th className="py-2.5 px-3">תיאור</th>
                  <th className="py-2.5 px-3">אבטחה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                <tr>
                  <td className="py-2.5 px-3 font-bold text-emerald-600">POST</td>
                  <td className="py-2.5 px-3">/api/v1/auth/register</td>
                  <td className="py-2.5 px-3 font-sans">רישום משתמש וארגון חדש</td>
                  <td className="py-2.5 px-3 font-sans">Zod Schema Validation</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-emerald-600">POST</td>
                  <td className="py-2.5 px-3">/api/v1/auth/login</td>
                  <td className="py-2.5 px-3 font-sans">כניסה עם סיסמה והנפקת עוגיית HttpOnly</td>
                  <td className="py-2.5 px-3 font-sans">Rate-Limited + Cookie</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-emerald-600">POST</td>
                  <td className="py-2.5 px-3">/api/v1/auth/pin-login</td>
                  <td className="py-2.5 px-3 font-sans">החלפת עובדים מהירה בטרמינל עם קוד PIN</td>
                  <td className="py-2.5 px-3 font-sans">5 נסיונות ← נעילה ל-15 דקות</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-blue-600">GET</td>
                  <td className="py-2.5 px-3">/api/v1/auth/me</td>
                  <td className="py-2.5 px-3 font-sans">פרופיל משתמש והרשאות הסשן הנוכחי</td>
                  <td className="py-2.5 px-3 font-sans">Session / Bearer Token</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-purple-600">POST</td>
                  <td className="py-2.5 px-3">/api/v1/realtime/ticket</td>
                  <td className="py-2.5 px-3 font-sans">הנפקת כרטיס חיבור חד-פעמי ל-WebSocket (60s)</td>
                  <td className="py-2.5 px-3 font-sans">Redis Single-Use Ticket</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
