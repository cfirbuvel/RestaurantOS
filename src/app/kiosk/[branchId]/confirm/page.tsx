import React from "react";
import { KioskConfirmScreen } from "@/components/public/KioskComponents";

export default async function KioskConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<{ orderNumber?: string }>;
}) {
  const { branchId } = await params;
  const { orderNumber } = await searchParams;

  return (
    <KioskConfirmScreen
      branchId={branchId}
      orderNumber={orderNumber || "101"}
    />
  );
}
