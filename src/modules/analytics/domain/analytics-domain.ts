export type DateRangeFilter = {
  startDate: string; // ISO string or YYYY-MM-DD
  endDate: string;   // ISO string or YYYY-MM-DD
};

export interface SalesDashboardMetrics {
  grossRevenue: number;
  netRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  totalTax: number;
  totalDiscounts: number;
  totalTips: number;
  cancelledOrderCount: number;
  cancellationRate: number;
  channelBreakdown: {
    channel: string;
    orderCount: number;
    revenue: number;
    percentage: number;
  }[];
  paymentBreakdown: {
    method: string;
    orderCount: number;
    amount: number;
    percentage: number;
  }[];
}

export interface KitchenAnalyticsMetrics {
  totalTickets: number;
  completedTickets: number;
  averagePrepTimeMinutes: number;
  slaExceededCount: number;
  slaExceededRate: number;
  targetSlaMinutes: number;
  stationThroughput: {
    stationId: string;
    stationName: string;
    itemsCompleted: number;
    averagePrepTimeMinutes: number;
    slaExceededCount: number;
  }[];
}

export interface DeliveryAnalyticsMetrics {
  totalDeliveries: number;
  completedDeliveries: number;
  averageFulfillmentTimeMinutes: number;
  averageDispatchWaitMinutes: number;
  slaComplianceRate: number;
  batchEfficiencyRate: number;
  totalBatches: number;
  averageOrdersPerBatch: number;
  topDrivers: {
    driverId: string;
    driverName: string;
    tripsCount: number;
    deliveriesCompleted: number;
    averageFulfillmentMinutes: number;
  }[];
}

export interface CustomerAnalyticsMetrics {
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  averageCustomerLtv: number;
  topCustomersBySpend: {
    customerId: string;
    name: string;
    phone: string;
    ordersCount: number;
    totalSpend: number;
    lastOrderDate: string;
  }[];
}

export interface InventoryAnalyticsMetrics {
  totalCogs: number;
  foodCostPercentage: number;
  totalWasteCost: number;
  wastePercentageOfCogs: number;
  topWasteReasons: {
    reason: string;
    cost: number;
    occurrences: number;
  }[];
  theoreticalVsActualVariance: {
    itemId: string;
    itemName: string;
    unit: string;
    theoreticalUsage: number;
    actualUsage: number;
    varianceQuantity: number;
    varianceCost: number;
  }[];
}

export interface MarketingAnalyticsMetrics {
  activeCampaignsCount: number;
  totalCouponsRedeemed: number;
  totalPromotionalDiscounts: number;
  loyaltyPointsIssued: number;
  loyaltyPointsRedeemed: number;
  loyaltyNetLiability: number;
  topCoupons: {
    code: string;
    redemptionCount: number;
    discountTotal: number;
  }[];
}

export interface IntelligenceAnalyticsMetrics {
  totalAdvisoryDecisions: number;
  approvedCount: number;
  rejectedCount: number;
  overriddenCount: number;
  approvalRate: number;
  overrideRate: number;
  byAlgorithm: {
    algorithmVersion: string;
    decisionsCount: number;
    approvalRate: number;
  }[];
}

export interface HourlyHeatmapPoint {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  dayName: string;   // "Sunday", etc.
  hour: number;      // 0..23
  orderCount: number;
  revenue: number;
}

export interface PeakHourSummary {
  busiestHours: {
    hour: number;
    formattedHour: string;
    averageOrders: number;
    averageRevenue: number;
  }[];
  quietHours: {
    hour: number;
    formattedHour: string;
    averageOrders: number;
    averageRevenue: number;
  }[];
}

export interface CashDrawerSession {
  id: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
  userId?: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  expectedCash: number;
  countedCash?: number;
  cashVariance?: number;
  notes?: string;
}

export interface EODReportData {
  reportId: string;
  reportDate: string;
  reportNumber: string;
  tenantId: string;
  branchId: string;
  branchName: string;
  generatedAt: string;
  generatedBy?: string;
  totalTransactions: number;
  grossSales: number;
  netSales: number;
  vatCollected: number;
  discountsTotal: number;
  tipsTotal: number;
  refundsTotal: number;
  paymentBreakdown: Record<string, { count: number; amount: number }>;
  channelBreakdown: Record<string, { count: number; amount: number }>;
  cashDrawer: {
    openingFloat: number;
    cashSales: number;
    expectedCash: number;
    countedCash: number;
    variance: number;
  };
}

export interface COGSReportData {
  reportDate: string;
  branchId: string;
  totalGrossFoodSales: number;
  totalCogs: number;
  foodCostPercentage: number;
  items: {
    productId: string;
    productName: string;
    unitsSold: number;
    revenue: number;
    unitCogs: number;
    totalCogs: number;
    foodCostPct: number;
  }[];
}
