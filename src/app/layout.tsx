import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RestaurantOS — מערכת הפעלה למסעדות",
  description: "פלטפורמה תפעולית מתקדמת לניהול הזמנות, מטבח דיגיטלי, משלוחים וצי רכבים",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-surface text-[#0B1C30] antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
