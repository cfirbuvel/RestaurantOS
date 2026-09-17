import React from "react";
import { publicMenuService } from "@/modules/public-ordering/services/public-menu-service";
import { ProductCard } from "@/components/public/ProductCard";
import { CartSummary } from "@/components/public/CartSummary";

export default async function RestaurantMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const menuData = await publicMenuService.getPublicMenu(slug);

  // Schema.org Menu structured data
  const menuJsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `תפריט ${menuData.restaurant.name}`,
    hasMenuSection: menuData.categories.map((cat) => ({
      "@type": "MenuSection",
      name: cat.name,
      description: cat.description,
      hasMenuItem: cat.products.map((prod) => ({
        "@type": "MenuItem",
        name: prod.name,
        description: prod.description,
        offers: {
          "@type": "Offer",
          price: prod.basePrice,
          priceCurrency: "ILS",
        },
      })),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd) }}
      />

      <div className="flex flex-col lg:flex-row items-start gap-8">
        {/* Main Menu Area */}
        <div className="flex-1 w-full space-y-8">
          {/* Category Quick Navigation Bar */}
          <div className="sticky top-20 z-30 bg-zinc-950/90 backdrop-blur-md py-3 -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-zinc-800/80">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {menuData.categories.map((cat) => (
                <a
                  key={cat.id}
                  href={`#category-${cat.id}`}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-amber-500/50 hover:bg-zinc-800 whitespace-nowrap transition-colors active:scale-95"
                >
                  {cat.name}
                </a>
              ))}
            </div>
          </div>

          {/* Categories & Products */}
          <div className="space-y-12">
            {menuData.categories.map((cat) => (
              <section key={cat.id} id={`category-${cat.id}`} className="scroll-mt-36 space-y-4">
                <div className="border-b border-zinc-800 pb-3">
                  <h2 className="text-xl sm:text-2xl font-black text-white">{cat.name}</h2>
                  {cat.description && (
                    <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">{cat.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
                  {cat.products.map((prod) => (
                    <ProductCard key={prod.id} product={prod} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Sticky Desktop Cart Sidebar (hidden on mobile, drawer used instead) */}
        <div className="hidden lg:block w-80 xl:w-96 sticky top-24 self-start max-h-[calc(100vh-7rem)]">
          <CartSummary slug={slug} isSidebar={true} />
        </div>
      </div>
    </>
  );
}
