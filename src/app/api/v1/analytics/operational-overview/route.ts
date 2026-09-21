import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { memoryDb, getPostgresPool } from "@/core/database/db";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "analytics.view") && !verifyPermission(auth.session, "orders.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || auth.branchId;
  if (!branchId) {
    return NextResponse.json({ error: "Branch context required" }, { status: 400 });
  }

  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let orders: any[] = [];
    let deliveries: any[] = [];
    let drivers: any[] = [];
    let tickets: any[] = [];

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      orders = memoryDb.find("orders", (o: any) => o.tenant_id === tenantId && o.branch_id === branchId);
      deliveries = memoryDb.find("deliveries", (d: any) => d.tenant_id === tenantId && d.branch_id === branchId);
      drivers = memoryDb.find("drivers", (d: any) => d.tenant_id === tenantId && d.branch_id === branchId && d.is_active);
      tickets = memoryDb.find("kds_tickets", (t: any) => t.tenant_id === tenantId && t.branch_id === branchId);
    } else {
      const pool = getPostgresPool();
      const [orderRes, delRes, drvRes, ticketRes] = await Promise.all([
        pool.query(`SELECT * FROM orders WHERE tenant_id = $1 AND branch_id = $2`, [tenantId, branchId]),
        pool.query(`SELECT * FROM deliveries WHERE tenant_id = $1 AND branch_id = $2`, [tenantId, branchId]),
        pool.query(`SELECT * FROM drivers WHERE tenant_id = $1 AND branch_id = $2 AND is_active = true`, [tenantId, branchId]),
        pool.query(`SELECT * FROM kds_tickets WHERE tenant_id = $1 AND branch_id = $2`, [tenantId, branchId]),
      ]);
      orders = orderRes.rows;
      deliveries = delRes.rows;
      drivers = drvRes.rows;
      tickets = ticketRes.rows;
    }

    const todayOrders = orders.filter((o) => new Date(o.created_at) >= startOfDay);
    const activeOrders = orders.filter((o) =>
      ["CONFIRMED", "ACCEPTED", "IN_PREPARATION", "READY"].includes(o.status)
    );
    const attentionOrders = orders.filter(
      (o) => o.status === "CONFIRMED" || (o.status === "IN_PREPARATION" && (now.getTime() - new Date(o.created_at).getTime()) > 25 * 60 * 1000)
    );

    const activeDeliveries = deliveries.filter((d) =>
      ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED_AT_CUSTOMER_AREA"].includes(d.status)
    );
    const waitingDeliveries = deliveries.filter((d) =>
      ["WAITING", "PREPARING", "READY", "AVAILABLE_FOR_ASSIGNMENT"].includes(d.status)
    );
    const unassignedDeliveries = deliveries.filter(
      (d) => d.status === "AVAILABLE_FOR_ASSIGNMENT" && !d.driver_id
    );

    const onShiftDrivers = drivers.filter((d) => d.shift_status === "ON_SHIFT");
    const availableDrivers = drivers.filter(
      (d) => d.shift_status === "ON_SHIFT" && d.assignment_status === "AVAILABLE"
    );
    const busyDrivers = drivers.filter(
      (d) => d.shift_status === "ON_SHIFT" && d.assignment_status === "ASSIGNED"
    );
    const onBreakDrivers = drivers.filter((d) => d.shift_status === "BREAK");

    const activeTickets = tickets.filter((t) => ["QUEUED", "STARTED"].includes(t.status));
    const overdueTickets = tickets.filter(
      (t) => ["QUEUED", "STARTED"].includes(t.status) && t.target_completion_time && new Date(t.target_completion_time) < now
    );

    const alerts: Array<{ id: string; type: "WARNING" | "CRITICAL" | "INFO"; title: string; message: string; actionRoute?: string }> = [];

    if (unassignedDeliveries.length > 0 && availableDrivers.length === 0) {
      alerts.push({
        id: "alert_no_drivers",
        type: "CRITICAL",
        title: "No Available Drivers",
        message: `${unassignedDeliveries.length} ready deliveries waiting for driver assignment.`,
        actionRoute: "deliveries",
      });
    }

    if (overdueTickets.length > 0) {
      alerts.push({
        id: "alert_kds_sla",
        type: "WARNING",
        title: "Kitchen SLA Breach",
        message: `${overdueTickets.length} kitchen ticket(s) exceeding target preparation SLA.`,
        actionRoute: "kds",
      });
    }

    if (attentionOrders.length > 3) {
      alerts.push({
        id: "alert_orders_backlog",
        type: "WARNING",
        title: "Order Acceptance Backlog",
        message: `${attentionOrders.length} orders awaiting confirmation or delayed.`,
        actionRoute: "orders",
      });
    }

    return NextResponse.json({
      timestamp: now.toISOString(),
      branchId,
      orders: {
        todayCount: todayOrders.length,
        activeCount: activeOrders.length,
        attentionRequiredCount: attentionOrders.length,
      },
      deliveries: {
        activeCount: activeDeliveries.length,
        waitingCount: waitingDeliveries.length,
        unassignedCount: unassignedDeliveries.length,
      },
      drivers: {
        onShiftCount: onShiftDrivers.length,
        availableCount: availableDrivers.length,
        busyCount: busyDrivers.length,
        onBreakCount: onBreakDrivers.length,
      },
      kds: {
        activeTicketsCount: activeTickets.length,
        overdueTicketsCount: overdueTickets.length,
      },
      alerts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load operational overview" },
      { status: 500 }
    );
  }
}
