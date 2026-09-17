import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { reportingService } from "@/modules/analytics";

describe("Phase 10: Reporting Service Unit Tests", () => {
  const tenantId = "tenant-reporting-test";
  const branchId = "branch-reporting-test";
  const todayStr = new Date().toISOString().split("T")[0];

  beforeEach(() => {
    memoryDb.reset();

    // Branch
    memoryDb.insert("branches", {
      id: branchId,
      tenant_id: tenantId,
      name: "סניף בדיקות",
    });

    // Seed test orders for today
    memoryDb.insert("orders", {
      id: "ord-rep-1",
      tenant_id: tenantId,
      branch_id: branchId,
      status: "COMPLETED",
      payment_status: "PAID",
      payment_method: "CASH",
      subtotal: 100,
      tax_amount: 17,
      discount_amount: 10,
      tip_amount: 5,
      total_amount: 112,
      channel: "TAKEAWAY",
      created_at: new Date().toISOString(),
    });

    memoryDb.insert("orders", {
      id: "ord-rep-2",
      tenant_id: tenantId,
      branch_id: branchId,
      status: "COMPLETED",
      payment_status: "PAID",
      payment_method: "CREDIT_CARD",
      subtotal: 60,
      tax_amount: 10.2,
      discount_amount: 0,
      tip_amount: 10,
      total_amount: 80.2,
      channel: "DINE_IN",
      created_at: new Date().toISOString(),
    });

    memoryDb.insert("orders", {
      id: "ord-rep-void",
      tenant_id: tenantId,
      branch_id: branchId,
      status: "CANCELLED",
      payment_status: "REFUNDED",
      payment_method: "CASH",
      total_amount: 50,
      channel: "DINE_IN",
      created_at: new Date().toISOString(),
    });

    // Product & recipe seeds for COGS testing
    memoryDb.insert("products", {
      id: "prod-burger",
      tenant_id: tenantId,
      name: "המבורגר שף",
      base_price: 60,
    });

    memoryDb.insert("order_items", {
      id: "oi-rep-1",
      order_id: "ord-rep-1",
      product_id: "prod-burger",
      quantity: 2,
      unit_price: 50,
      total_price: 100,
    });
  });

  it("should generate a complete End-of-Day (EOD) Z-Report and persist an immutable snapshot", async () => {
    const report = await reportingService.generateEODReport(tenantId, branchId, todayStr, "manager-user-1");

    expect(report.branchName).toBe("סניף בדיקות");
    expect(report.totalTransactions).toBe(2);
    // ord-rep-1 (112) + ord-rep-2 (80.2) = 192.2
    expect(report.grossSales).toBe(192.2);
    expect(report.vatCollected).toBe(27.2);
    expect(report.discountsTotal).toBe(10);
    expect(report.tipsTotal).toBe(15);
    expect(report.refundsTotal).toBe(50); // ord-rep-void

    expect(report.paymentBreakdown.CASH.amount).toBe(112);
    expect(report.paymentBreakdown.CREDIT_CARD.amount).toBe(80.2);

    // Assert immutable snapshot is created in eod_reports
    const saved = memoryDb.find("eod_reports", (r: any) => r.tenant_id === tenantId && r.report_date === todayStr);
    expect(saved).toHaveLength(1);
    expect(saved[0].gross_sales).toBe(192.2);

    // Subsequent call retrieves the exact snapshot
    const cachedReport = await reportingService.generateEODReport(tenantId, branchId, todayStr);
    expect(cachedReport.reportId).toBe(report.reportId);
  });

  it("should open, track cash sales, and close cash drawer calculating variance", async () => {
    // 1. Open drawer with 500 NIS float
    const session = await reportingService.openCashDrawer(tenantId, branchId, "POS-01", 500, "user-cashier");
    expect(session.status).toBe("OPEN");
    expect(session.openingFloat).toBe(500);

    // ord-rep-1 has 112 NIS cash sales. Expected cash = 500 + 112 = 612 NIS
    // Cashier counted 610 NIS (shortage of 2 NIS)
    const closedSession = await reportingService.closeCashDrawer(tenantId, session.id, 610, "ספירת קופה בסוף משמרת");

    expect(closedSession.status).toBe("CLOSED");
    expect(closedSession.expectedCash).toBe(612);
    expect(closedSession.countedCash).toBe(610);
    expect(closedSession.cashVariance).toBe(-2);
    expect(closedSession.notes).toBe("ספירת קופה בסוף משמרת");
  });

  it("should generate COGS Food Cost report with recipe BOM breakdown", async () => {
    const cogsReport = await reportingService.generateCOGSReport(tenantId, branchId, todayStr);

    expect(cogsReport.items).toHaveLength(1);
    const burgerItem = cogsReport.items[0];
    expect(burgerItem.productName).toBe("המבורגר שף");
    expect(burgerItem.unitsSold).toBe(2);
    expect(burgerItem.revenue).toBe(100);
    expect(burgerItem.totalCogs).toBeGreaterThan(0);
    expect(cogsReport.foodCostPercentage).toBeGreaterThan(0);
  });
});
