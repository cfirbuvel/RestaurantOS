import React from "react";
import type { Metadata } from "next";
import { publicMenuService } from "@/modules/public-ordering/services/public-menu-service";
import { LanguageProvider } from "@/components/public/LanguageContext";
import { CartProvider } from "@/components/public/CartContext";
import { PublicHeader } from "@/components/public/PublicHeader";
import { CartSummary } from "@/components/public/CartSummary";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const info = await publicMenuService.getRestaurantPublicInfo(slug);

  return {
    title: `${info.name} | הזמנה אונליין ומשלוחים`,
    description: info.description || `${info.name} - תפריט משלוחים ואיסוף עצמי`,
    openGraph: {
      title: `${info.name} - תפריט משלוחים`,
      description: info.description || info.tagline,
      type: "website",
      locale: "he_IL",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurantInfo = await publicMenuService.getRestaurantPublicInfo(slug);

  // Structured Data: Schema.org Restaurant
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurantInfo.name,
    description: restaurantInfo.description,
    telephone: restaurantInfo.phone,
    email: restaurantInfo.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${restaurantInfo.address.street} ${restaurantInfo.address.houseNumber}`,
      addressLocality: restaurantInfo.address.city,
      addressCountry: "IL",
    },
    servesCuisine: "Burgers, Fast Food, Israeli",
    priceRange: "₪₪",
    openingHoursSpecification: restaurantInfo.operatingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.day,
      opens: h.open,
      closes: h.close,
    })),
  };

  return (
    <LanguageProvider>
      <CartProvider slug={slug} defaultDeliveryFee={restaurantInfo.deliveryFee}>
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-zinc-950">
          <PublicHeader restaurant={restaurantInfo} slug={slug} />

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </main>

          {/* Cart Drawer for slide-in on mobile / header click */}
          <CartSummary slug={slug} />

          {/* Footer */}
          <footer className="bg-zinc-900 border-t border-zinc-800 py-8 text-center text-xs text-zinc-500">
            <div className="max-w-7xl mx-auto px-4 space-y-2">
              <p className="font-semibold text-zinc-400">
                {restaurantInfo.name} • {restaurantInfo.address.street} {restaurantInfo.address.houseNumber},{" "}
                {restaurantInfo.address.city} • 📞 {restaurantInfo.phone}
              </p>
              <p>Powered by RestaurantOS • הזמנה מאובטחת ועמידה בתקני PCI-DSS</p>
            </div>
          </footer>
        </div>
      </CartProvider>
    </LanguageProvider>
  );
}
