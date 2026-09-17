import React from "react";
import { publicMenuService } from "@/modules/public-ordering/services/public-menu-service";
import { KioskAttractScreen } from "@/components/public/KioskComponents";

export default async function KioskPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const restaurant = await publicMenuService.getRestaurantPublicInfo(branchId);

  return <KioskAttractScreen restaurant={restaurant} branchId={branchId} />;
}
