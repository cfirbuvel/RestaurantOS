import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { orderService } from "@/modules/orders/services/order-service";
import { createOrderSchema, OrderChannel, OrderStatus, OrderType } from "@/modules/orders/domain/order";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "orders.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || auth.branchId || undefined;
  const status = (url.searchParams.get("status") as OrderStatus) || undefined;
  const channel = (url.searchParams.get("channel") as OrderChannel) || undefined;
  const orderType = (url.searchParams.get("orderType") as OrderType) || undefined;
  const customerId = url.searchParams.get("customerId") || undefined;
  const limit = Number(url.searchParams.get("limit")) || 50;

  const orders = await orderService.listOrders(tenantId, {
    branchId,
    status,
    channel,
    orderType,
    customerId,
    limit,
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "orders.create")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createOrderSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const order = await orderService.createOrder({
      tenantId,
      branchId: validated.data.branchId,
      customerId: validated.data.customerId,
      channel: validated.data.channel,
      orderType: validated.data.orderType,
      items: validated.data.items,
      deliveryAddressId: validated.data.deliveryAddressId,
      notes: validated.data.notes,
      kitchenNotes: validated.data.kitchenNotes,
      discountAmount: validated.data.discountAmount,
      deliveryFee: validated.data.deliveryFee,
      tipAmount: validated.data.tipAmount,
      externalOrderId: validated.data.externalOrderId,
      metadata: validated.data.metadata,
      autoConfirm: validated.data.autoConfirm,
      actorId: auth.userId,
      actorType: "USER",
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create order" }, { status: 400 });
  }
}
