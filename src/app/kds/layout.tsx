import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RestaurantOS — מסך מטבח דיגיטלי (KDS Rail)",
  description: "מערכת ניהול הזמנות ומסילות בישול למטבחים בזמן אמת",
};

export default function KDSLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen w-screen overflow-hidden select-none font-sans">
      {children}
    </div>
  );
}
