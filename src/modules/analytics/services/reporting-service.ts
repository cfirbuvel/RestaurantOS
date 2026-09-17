import { memoryDb } from "@/core/database/db";
import {
  EODReportData,
  COGSReportData,
  CashDrawerSession,
} from "../domain/analytics-domain";

export class ReportingService {
  /**
   * Generates or fetches an End-of-Day (EOD) Z-Report for a specific branch and business date
   */
  async generateEODReport(
    tenantId: string,
    branchId: string,
    reportDateStr: string, // YYYY-MM-DD
    actorId?: string
  ): Promise<EODReportData> {
    const branch = memoryDb.findById("branches", branchId);
    const branchName = branch?.name || "סניף ראשי";

    // Check if an immutable Z-report already exists for this day
    const existing = memoryDb.find("eod_reports", (r: any) => {
      return r.tenant_id === tenantId && r.branch_id === branchId && r.report_date === reportDateStr;
    });

    if (existing.length > 0) {
      const snap = existing[0];
      return {
        reportId: snap.id,
        reportDate: snap.report_date,
        reportNumber: snap.report_number,
        tenantId: snap.tenant_id,
        branchId: snap.branch_id,
        branchName,
        generatedAt: snap.created_at,
        generatedBy: snap.generated_by,
        totalTransactions: snap.total_transactions,
        grossSales: Number(snap.gross_sales),
        netSales: Number(snap.net_sales),
        vatCollected: Number(snap.vat_collected),
        discountsTotal: Number(snap.discounts_total),
        tipsTotal: Number(snap.tips_total),
        refundsTotal: Number(snap.refunds_total),
        paymentBreakdown: snap.payment_breakdown || {},
        channelBreakdown: snap.channel_breakdown || {},
        cashDrawer: snap.cash_drawer || {
          openingFloat: 500,
          cashSales: 0,
          expectedCash: 500,
          countedCash: 500,
          variance: 0,
        },
      };
    }

    // Query orders for that specific date
    const orders = memoryDb.find("orders", (o: any) => {
      if (o.tenant_id !== tenantId || o.branch_id !== branchId) return false;
      const oDate = new Date(o.created_at).toISOString().split("T")[0];
      return oDate === reportDateStr;
    });

    let totalTransactions = 0;
    let grossSales = 0;
    let netSales = 0;
    let vatCollected = 0;
    let discountsTotal = 0;
    let tipsTotal = 0;
    let refundsTotal = 0;

    const paymentBreakdown: Record<string, { count: number; amount: number }> = {
      CASH: { count: 0, amount: 0 },
      CREDIT_CARD: { count: 0, amount: 0 },
      WOLT_PAY: { count: 0, amount: 0 },
      TENBIS_PAY: { count: 0, amount: 0 },
      CIBUS: { count: 0, amount: 0 },
    };

    const channelBreakdown: Record<string, { count: number; amount: number }> = {};

    let cashSalesTotal = 0;

    for (const ord of orders) {
      if (ord.status === "CANCELLED") {
        refundsTotal += Number(ord.total_amount || 0);
        continue;
      }

      totalTransactions++;
      const tot = Number(ord.total_amount || 0);
      const tax = Number(ord.tax_amount || 0);
      const disc = Number(ord.discount_amount || 0);
      const tip = Number(ord.tip_amount || 0);

      grossSales += tot;
      vatCollected += tax;
      discountsTotal += disc;
      tipsTotal += tip;
      netSales += Math.max(0, tot - tax - disc - tip);

      // Payment method grouping
      const method = ord.payment_method || (ord.payment_status === "PAID" ? "CREDIT_CARD" : "CASH");
      if (!paymentBreakdown[method]) {
        paymentBreakdown[method] = { count: 0, amount: 0 };
      }
      paymentBreakdown[method].count += 1;
      paymentBreakdown[method].amount += tot;

      if (method === "CASH") {
        cashSalesTotal += tot;
      }

      // Channel grouping
      const ch = ord.channel || "UNKNOWN";
      if (!channelBreakdown[ch]) {
        channelBreakdown[ch] = { count: 0, amount: 0 };
      }
      channelBreakdown[ch].count += 1;
      channelBreakdown[ch].amount += tot;
    }

    // Check cash drawer session for that day
    const drawerSessions = memoryDb.find("cash_drawer_sessions", (s: any) => {
      if (s.tenant_id !== tenantId || s.branch_id !== branchId) return false;
      const sDate = new Date(s.opened_at).toISOString().split("T")[0];
      return sDate === reportDateStr;
    });

    const activeSession = drawerSessions[drawerSessions.length - 1];
    const openingFloat = activeSession ? Number(activeSession.opening_float) : 500;
    const expectedCash = openingFloat + cashSalesTotal;
    const countedCash = activeSession?.counted_cash !== undefined ? Number(activeSession.counted_cash) : expectedCash;
    const variance = countedCash - expectedCash;

    const reportNumber = `Z-${reportDateStr.replace(/-/g, "")}-${branchId.slice(0, 4).toUpperCase()}`;
    const reportId = `eod-${Date.now()}`;

    const reportData: EODReportData = {
      reportId,
      reportDate: reportDateStr,
      reportNumber,
      tenantId,
      branchId,
      branchName,
      generatedAt: new Date().toISOString(),
      generatedBy: actorId,
      totalTransactions,
      grossSales: Math.round(grossSales * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      vatCollected: Math.round(vatCollected * 100) / 100,
      discountsTotal: Math.round(discountsTotal * 100) / 100,
      tipsTotal: Math.round(tipsTotal * 100) / 100,
      refundsTotal: Math.round(refundsTotal * 100) / 100,
      paymentBreakdown,
      channelBreakdown,
      cashDrawer: {
        openingFloat,
        cashSales: Math.round(cashSalesTotal * 100) / 100,
        expectedCash: Math.round(expectedCash * 100) / 100,
        countedCash: Math.round(countedCash * 100) / 100,
        variance: Math.round(variance * 100) / 100,
      },
    };

    // Save immutable snapshot to memoryDb
    memoryDb.insert("eod_reports", {
      id: reportId,
      tenant_id: tenantId,
      branch_id: branchId,
      report_date: reportDateStr,
      report_number: reportNumber,
      generated_by: actorId,
      total_transactions: totalTransactions,
      gross_sales: reportData.grossSales,
      net_sales: reportData.netSales,
      vat_collected: reportData.vatCollected,
      discounts_total: reportData.discountsTotal,
      tips_total: reportData.tipsTotal,
      refunds_total: reportData.refundsTotal,
      payment_breakdown: paymentBreakdown,
      channel_breakdown: channelBreakdown,
      cash_drawer: reportData.cashDrawer,
      created_at: reportData.generatedAt,
    });

    return reportData;
  }

  /**
   * Cash Drawer Session Management
   */
  async openCashDrawer(
    tenantId: string,
    branchId: string,
    terminalId: string,
    openingFloat: number,
    userId?: string
  ): Promise<CashDrawerSession> {
    const sessionId = `cds-${Date.now()}`;
    const session: CashDrawerSession = {
      id: sessionId,
      tenantId,
      branchId,
      terminalId,
      userId,
      status: "OPEN",
      openedAt: new Date().toISOString(),
      openingFloat,
      expectedCash: openingFloat,
    };

    memoryDb.insert("cash_drawer_sessions", {
      id: sessionId,
      tenant_id: tenantId,
      branch_id: branchId,
      terminal_id: terminalId,
      user_id: userId,
      status: "OPEN",
      opened_at: session.openedAt,
      opening_float: openingFloat,
      expected_cash: openingFloat,
      counted_cash: null,
      cash_variance: null,
    });

    return session;
  }

  async closeCashDrawer(
    tenantId: string,
    sessionId: string,
    countedCash: number,
    notes?: string
  ): Promise<CashDrawerSession> {
    const row = memoryDb.findById("cash_drawer_sessions", sessionId);
    if (!row || row.tenant_id !== tenantId) {
      throw new Error("Cash drawer session not found");
    }

    const openingFloat = Number(row.opening_float || 0);

    // Calculate cash sales while this session was open
    const orders = memoryDb.find("orders", (o: any) => {
      if (o.tenant_id !== tenantId || o.branch_id !== row.branch_id) return false;
      if (o.status === "CANCELLED") return false;
      const isCash = o.payment_method === "CASH" || (!o.payment_method && o.payment_status !== "PAID");
      const oDate = new Date(o.created_at).toISOString().split("T")[0];
      const sDate = new Date(row.opened_at).toISOString().split("T")[0];
      return isCash && oDate === sDate;
    });

    const cashSales = orders.reduce((acc: number, o: any) => acc + Number(o.total_amount || 0), 0);
    const expectedCash = openingFloat + cashSales;
    const variance = countedCash - expectedCash;
    const closedAt = new Date().toISOString();

    const updated = {
      ...row,
      status: "CLOSED",
      closed_at: closedAt,
      expected_cash: expectedCash,
      counted_cash: countedCash,
      cash_variance: variance,
      notes: notes || row.notes,
    };

    memoryDb.update("cash_drawer_sessions", sessionId, updated);

    return {
      id: sessionId,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      terminalId: row.terminal_id,
      userId: row.user_id,
      status: "CLOSED",
      openedAt: row.opened_at,
      closedAt,
      openingFloat,
      expectedCash: Math.round(expectedCash * 100) / 100,
      countedCash: Math.round(countedCash * 100) / 100,
      cashVariance: Math.round(variance * 100) / 100,
      notes,
    };
  }

  /**
   * Cost of Goods Sold (COGS) Product Variance Report
   */
  async generateCOGSReport(
    tenantId: string,
    branchId: string,
    dateStr: string
  ): Promise<COGSReportData> {
    const products = memoryDb.find("products", (p: any) => p.tenant_id === tenantId);
    const orders = memoryDb.find("orders", (o: any) => {
      if (o.tenant_id !== tenantId || o.branch_id !== branchId) return false;
      if (o.status === "CANCELLED") return false;
      return true;
    });
    const orderItems = memoryDb.find("order_items", () => true);
    const recipes = memoryDb.find("recipes", (r: any) => r.tenant_id === tenantId);
    const recipeItems = memoryDb.find("recipe_items", () => true);
    const inventoryItems = memoryDb.find("inventory_items", (i: any) => i.tenant_id === tenantId);

    let totalGrossSales = 0;
    let totalCogsAll = 0;

    const items = products.map((prod: any) => {
      const soldItems = orderItems.filter((oi: any) => {
        const parentOrder = orders.find((o: any) => o.id === oi.order_id);
        return Boolean(parentOrder) && oi.product_id === prod.id;
      });

      const unitsSold = soldItems.reduce((acc: number, item: any) => acc + Number(item.quantity || 1), 0);
      const revenue = soldItems.reduce((acc: number, item: any) => acc + Number(item.total_price || 0), 0);

      // Recipe BOM unit cost
      let unitCogs = 0;
      const recipe = recipes.find((r: any) => r.product_id === prod.id);
      if (recipe) {
        const rItems = recipeItems.filter((ri: any) => ri.recipe_id === recipe.id);
        for (const ri of rItems) {
          const invItem = inventoryItems.find((ii: any) => ii.id === ri.inventory_item_id);
          unitCogs += Number(ri.quantity || 1) * Number(invItem?.cost_per_unit || 2.0);
        }
      } else {
        unitCogs = Number(prod.base_price || 50) * 0.28;
      }

      const totalCogs = unitsSold * unitCogs;
      const foodCostPct = revenue > 0 ? Math.round((totalCogs / revenue) * 10000) / 100 : 0;

      totalGrossSales += revenue;
      totalCogsAll += totalCogs;

      return {
        productId: prod.id,
        productName: prod.name,
        unitsSold,
        revenue: Math.round(revenue * 100) / 100,
        unitCogs: Math.round(unitCogs * 100) / 100,
        totalCogs: Math.round(totalCogs * 100) / 100,
        foodCostPct,
      };
    });

    const foodCostPercentage = totalGrossSales > 0
      ? Math.round((totalCogsAll / totalGrossSales) * 10000) / 100
      : 29.5;

    return {
      reportDate: dateStr,
      branchId,
      totalGrossFoodSales: Math.round(totalGrossSales * 100) / 100,
      totalCogs: Math.round(totalCogsAll * 100) / 100,
      foodCostPercentage,
      items,
    };
  }
}

export const reportingService = new ReportingService();
