import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { analyticsService } from "@/modules/analytics";

describe("Phase 10: Analytics Service Unit Tests", () => {
  const tenantId = "tenant-analytics-test";
  const branchId = "branch-analytics-test";

  beforeEach(() => {
    memoryDb.reset();

    // Seed test orders
    memoryDb.insert("orders", {
      id: "ord-1",
      tenant_id: tenantId,
      branch_id: branchId,
      customer_id: "cust-1",
      channel: "WEB",
      status: "COMPLETED",
      payment_status: "PAID",
      payment_method: "CREDIT_CARD",
      subtotal: 100,
      tax_amount: 17,
      discount_amount: 10,
      delivery_fee: 15,
      tip_amount: 10,
      total_amount: 132,
      created_at: new Date().toISOString(),
    });

    memoryDb.insert("orders", {
      id: "ord-2",
      tenant_id: tenantId,
      branch_id: branchId,
      customer_id: "cust-1",
      channel: "KIOSK",
      status: "COMPLETED",
      payment_status: "PAID",
      payment_method: "CASH",
      subtotal: 50,
      tax_amount: 8.5,
      discount_amount: 0,
      delivery_fee: 0,
      tip_amount: 0,
      total_amount: 58.5,
      created_at: new Date().toISOString(),
    });

    memoryDb.insert("orders", {
      id: "ord-cancelled",
      tenant_id: tenantId,
      branch_id: branchId,
      customer_id: "cust-2",
      channel: "WEB",
      status: "CANCELLED",
      payment_status: "REFUNDED",
      subtotal: 80,
      tax_amount: 13.6,
      discount_amount: 0,
      delivery_fee: 0,
      tip_amount: 0,
      total_amount: 93.6,
      created_at: new Date().toISOString(),
    });

    // Seed test customers
    memoryDb.insert("customers", {
      id: "cust-1",
      tenant_id: tenantId,
      first_name: "ישראל",
      last_name: "ישראלי",
      phone: "0501112233",
      created_at: new Date().toISOString(),
    });

    memoryDb.insert("customers", {
      id: "cust-2",
      tenant_id: tenantId,
      first_name: "דנה",
      last_name: "כהן",
      phone: "0529998877",
      created_at: new Date().toISOString(),
    });

    // Seed KDS stations & tickets
    memoryDb.insert("kds_stations", {
      id: "st-grill",
      tenant_id: tenantId,
      branch_id: branchId,
      name: "grill",
      display_name: "גריל",
    });

    memoryDb.insert("kds_tickets", {
      id: "tkt-1",
      tenant_id: tenantId,
      branch_id: branchId,
      station_id: "st-grill",
      order_id: "ord-1",
      status: "READY",
      created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      ready_at: new Date().toISOString(), // 12 minutes (within 15m SLA)
    });

    memoryDb.insert("kds_tickets", {
      id: "tkt-2",
      tenant_id: tenantId,
      branch_id: branchId,
      station_id: "st-grill",
      order_id: "ord-2",
      status: "READY",
      created_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
      ready_at: new Date().toISOString(), // 22 minutes (exceeded 15m SLA)
    });

    // Seed Deliveries
    memoryDb.insert("deliveries", {
      id: "del-1",
      tenant_id: tenantId,
      branch_id: branchId,
      order_id: "ord-1",
      driver_id: "drv-1",
      status: "DELIVERED",
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      delivered_at: new Date().toISOString(),
    });

    memoryDb.insert("drivers", {
      id: "drv-1",
      tenant_id: tenantId,
      full_name: "יוסי שליח",
      status: "AVAILABLE",
    });

    // Seed Decision logs (Phase 00 section 13)
    memoryDb.insert("intelligence_decision_logs", {
      id: "idl-1",
      tenant_id: tenantId,
      branch_id: branchId,
      decision_type: "BATCH_OFFER",
      algorithm_version: "smart-batch-v1",
      action_taken: "APPROVED",
      created_at: new Date().toISOString(),
    });

    memoryDb.insert("intelligence_decision_logs", {
      id: "idl-2",
      tenant_id: tenantId,
      branch_id: branchId,
      decision_type: "BATCH_OFFER",
      algorithm_version: "smart-batch-v1",
      action_taken: "OVERRIDDEN",
      created_at: new Date().toISOString(),
    });
  });

  it("should calculate executive sales metrics accurately and exclude cancelled orders from gross revenue", async () => {
    const sales = await analyticsService.getSalesDashboard(tenantId, branchId);

    // ord-1 (132) + ord-2 (58.5) = 190.5
    expect(sales.grossRevenue).toBe(190.5);
    expect(sales.orderCount).toBe(2);
    expect(sales.cancelledOrderCount).toBe(1);
    expect(sales.cancellationRate).toBe(33.33); // 1 out of 3 = 33.33%
    expect(sales.averageOrderValue).toBe(95.25); // 190.5 / 2

    // Check channels
    expect(sales.channelBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "WEB", orderCount: 1, revenue: 132 }),
        expect.objectContaining({ channel: "KIOSK", orderCount: 1, revenue: 58.5 }),
      ])
    );

    // Check payments
    expect(sales.paymentBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "CREDIT_CARD", orderCount: 1, amount: 132 }),
        expect.objectContaining({ method: "CASH", orderCount: 1, amount: 58.5 }),
      ])
    );
  });

  it("should calculate kitchen SLA compliance and prep times", async () => {
    const kitchen = await analyticsService.getKitchenAnalytics(tenantId, branchId);

    expect(kitchen.totalTickets).toBe(2);
    expect(kitchen.completedTickets).toBe(2);
    expect(kitchen.slaExceededCount).toBe(1); // tkt-2 took 22m > 15m
    expect(kitchen.slaExceededRate).toBe(50); // 1 out of 2 = 50%
    expect(kitchen.averagePrepTimeMinutes).toBe(17); // (12 + 22) / 2 = 17m

    expect(kitchen.stationThroughput).toHaveLength(1);
    expect(kitchen.stationThroughput[0].stationId).toBe("st-grill");
  });

  it("should calculate delivery fulfillment and driver metrics", async () => {
    const delivery = await analyticsService.getDeliveryAnalytics(tenantId, branchId);

    expect(delivery.totalDeliveries).toBe(1);
    expect(delivery.completedDeliveries).toBe(1);
    expect(delivery.slaComplianceRate).toBe(100);
    expect(delivery.topDrivers).toHaveLength(1);
    expect(delivery.topDrivers[0].driverName).toBe("יוסי שליח");
  });

  it("should calculate customer retention and repeat rate", async () => {
    const customers = await analyticsService.getCustomerAnalytics(tenantId);

    expect(customers.totalCustomers).toBe(2);
    expect(customers.repeatCustomers).toBe(1); // cust-1 had 2 completed orders
    expect(customers.newCustomers).toBe(1);
    expect(customers.repeatRate).toBe(50); // 1 out of 2 = 50%
    expect(customers.topCustomersBySpend[0].customerId).toBe("cust-1");
    expect(customers.topCustomersBySpend[0].totalSpend).toBe(190.5);
  });

  it("should calculate Phase 00 decision intelligence approval & override rates", async () => {
    const intelligence = await analyticsService.getIntelligenceAnalytics(tenantId, branchId);

    expect(intelligence.totalAdvisoryDecisions).toBe(2);
    expect(intelligence.approvedCount).toBe(1);
    expect(intelligence.overriddenCount).toBe(1);
    expect(intelligence.approvalRate).toBe(50);
    expect(intelligence.overrideRate).toBe(50);
    expect(intelligence.byAlgorithm[0].algorithmVersion).toBe("smart-batch-v1");
  });

  it("should generate a 7x24 hourly heatmap and peak hours summary", async () => {
    const heatmap = await analyticsService.getHourlyHeatmap(tenantId, branchId);
    expect(heatmap).toHaveLength(7 * 24); // 168 cells

    const peakHours = await analyticsService.getPeakHourAnalysis(tenantId, branchId);
    expect(peakHours.busiestHours.length).toBeGreaterThan(0);
    expect(peakHours.quietHours.length).toBeGreaterThan(0);
  });
});
