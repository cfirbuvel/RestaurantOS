import React from "react";
import type { Metadata } from "next";
import { LanguageProvider } from "@/components/public/LanguageContext";
import { CartProvider } from "@/components/public/CartContext";
import { KioskSessionGuard } from "@/components/public/KioskComponents";

export const metadata: Metadata = {
  title: "עמדת הזמנה עצמית | RestaurantOS Kiosk",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function KioskLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;

  return (
    <LanguageProvider>
      <CartProvider slug={branchId} isKiosk={true}>
        <KioskSessionGuard branchId={branchId} timeoutSeconds={120} warningSeconds={20}>
          <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col select-none overflow-x-hidden font-sans">
            {children}
          </div>
        </KioskSessionGuard>
      </CartProvider>
    </LanguageProvider>
  );
}
