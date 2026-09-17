import React from "react";
import Link from "next/link";
import { publicMenuService } from "@/modules/public-ordering/services/public-menu-service";

export default async function RestaurantLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await publicMenuService.getRestaurantPublicInfo(slug);
  const menuData = await publicMenuService.getPublicMenu(slug);

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-850 border border-zinc-800 p-6 sm:p-12 shadow-2xl">
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              🍔 משלוחים ואיסוף עצמי
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              🟢 פתוח להזמנות עכשיו
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            {restaurant.name}
          </h1>

          <p className="text-base sm:text-xl text-zinc-300 font-medium leading-relaxed">
            {restaurant.description || restaurant.tagline}
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <Link
              href={`/r/${slug}/menu`}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-lg shadow-xl shadow-amber-500/25 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>לתפריט והזמנה אונליין</span>
              <span>←</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Info & Delivery Stats Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl font-bold">
            🛵
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-200">זמן הגעה משוער</h3>
            <p className="text-xl font-extrabold text-white">~{restaurant.estimatedDeliveryTimeMinutes} דקות</p>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl font-bold">
            💰
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-200">מינימום להזמנה</h3>
            <p className="text-xl font-extrabold text-white">₪{restaurant.minOrderAmount.toFixed(0)}</p>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-2xl font-bold">
            📍
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-200">כתובת הסניף</h3>
            <p className="text-sm font-semibold text-white">
              {restaurant.address.street} {restaurant.address.houseNumber}, {restaurant.address.city}
            </p>
          </div>
        </div>
      </section>

      {/* Featured Categories Overview */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">הקטגוריות שלנו</h2>
          <Link
            href={`/r/${slug}/menu`}
            className="text-sm font-bold text-amber-400 hover:text-amber-300"
          >
            לכל התפריט ←
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {menuData.categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/r/${slug}/menu#${cat.slug}`}
              className="group bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-3xl p-6 transition-all hover:scale-[1.02] shadow-md flex flex-col justify-between"
            >
              <div>
                <span className="text-3xl block mb-3">🍔</span>
                <h3 className="font-bold text-xl text-white group-hover:text-amber-400 transition-colors">
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">{cat.description}</p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-400">
                <span>{cat.products.length} מנות לבחירה</span>
                <span className="text-amber-400">צפה במנות →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Opening Hours & Details */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🕒</span>
          <span>שעות פעילות ומשלוחים</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {restaurant.operatingHours.map((h, i) => (
            <div
              key={i}
              className="bg-zinc-850/60 border border-zinc-800 rounded-2xl p-4 flex justify-between items-center text-sm"
            >
              <span className="font-bold text-zinc-300">{h.dayHe}</span>
              <span className="text-amber-400 font-mono font-semibold">
                {h.open} - {h.close}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
