import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { checkoutService } from "@/modules/public-ordering/services/checkout-service";
import { OrderStatusTracker } from "@/components/public/OrderStatusTracker";

export const metadata: Metadata = {
  title: "מעקב הזמנה | RestaurantOS",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug, orderId } = await params;
  const { token } = await searchParams;

  const initialData = await checkoutService.getOrderStatus(slug, orderId, token);

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/r/${slug}/menu`}
          className="text-xs sm:text-sm font-bold text-amber-400 hover:underline flex items-center gap-1.5"
        >
          <span>←</span>
          <span>הזמנה חדשה</span>
        </Link>
        <span className="text-xs text-zinc-500 font-mono">ID: {orderId}</span>
      </div>

      <OrderStatusTracker
        slug={slug}
        orderId={orderId}
        initialData={initialData}
        token={token}
      />
    </div>
  );
}
