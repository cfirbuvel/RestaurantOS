import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://restaurantos.app";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/r/*", "/menu/*", "/order/*", "/restaurant/*"],
      disallow: ["/api/", "/kiosk/", "/backoffice/", "/pos/", "/kds/", "/admin/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
