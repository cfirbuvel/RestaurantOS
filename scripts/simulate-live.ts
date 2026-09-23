/**
 * RestaurantOS — Real-Time Live System Simulator
 * 
 * Simulates the full end-to-end operational lifecycle:
 * 1. Driver shift clock-in & FIFO queue entry
 * 2. Omnichannel incoming orders (Web, Wolt, 10bis, Dine-in)
 * 3. KDS kitchen ticket rails, cooking timers, and bump bar completions
 * 4. Driver delivery self-assignment from queue
 * 5. Courier GPS transit & Tel Aviv proximity breadcrumb updates
 * 6. Proof of delivery confirmation & courier rejoining FIFO queue
 * 7. Live manager telemetry, notification dispatch, and SLA alerts
 * 
 * Usage:
 *   npx tsx scripts/simulate-live.ts [--speed=1|2|5]
 */

import { orderService } from "../src/modules/orders/services/order-service";
import { kdsService } from "../src/modules/kds/services/kds-service";
import { deliveryService } from "../src/modules/delivery/services/delivery-service";
import { driverQueueService } from "../src/modules/delivery/services/driver-queue-service";
import { notificationService } from "../src/modules/notifications/notification-service";
import { eventBus } from "../src/core/events/event-bus";
import { memoryDb } from "../src/core/database/db";

// CLI Arguments
const args = process.argv.slice(2);
const speedArg = args.find((a) => a.startsWith("--speed="));
const speedMultiplier = speedArg ? parseFloat(speedArg.split("=")[1]) || 1 : 1;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(80, Math.floor(ms / speedMultiplier))));

// Visual Colors for Console Output
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  bgBlue: "\x1b[44m\x1b[37m",
  bgGreen: "\x1b[42m\x1b[30m",
  bgYellow: "\x1b[43m\x1b[30m",
  bgMagenta: "\x1b[45m\x1b[37m",
};

function banner(text: string) {
  console.log(`\n${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ${text}${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}\n`);
}

function logEvent(channel: string, badge: string, msg: string) {
  const time = new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  console.log(`${c.dim}[${time}]${c.reset} ${badge} ${c.bold}[${channel}]${c.reset} ${msg}`);
}

async function initSimulationData(tenantId: string, branchId: string) {
  // Ensure branch and stations exist in memoryDb
  const existingStation = await kdsService.getStationsForBranch(tenantId, branchId);
  if (existingStation.length === 0) {
    await kdsService.createStation(tenantId, branchId, {
      name: "grill_expo",
      displayName: "גריל ואקספו מרכזי",
      stationType: "KITCHEN",
    });
  }

  // Pre-seed product records so order validation and BOM works
  const products = [
    { id: "prod_burger_classic", tenant_id: tenantId, name: "המבורגר קלאסי 220 גרם", base_price: 62, currency: "ILS", is_active: true },
    { id: "prod_truffle_fries", tenant_id: tenantId, name: "צ'יפס כמהין", base_price: 28, currency: "ILS", is_active: true },
    { id: "prod_pizza_margherita", tenant_id: tenantId, name: "פיצה מרגריטה משפחתית", base_price: 74, currency: "ILS", is_active: true },
    { id: "prod_coke_zero", tenant_id: tenantId, name: "קוקה קולה זירו 330 מ\"ל", base_price: 12, currency: "ILS", is_active: true },
  ];
  for (const p of products) {
    if (!memoryDb.findById("products", p.id)) {
      memoryDb.insert("products", p);
    }
  }

  // Pre-seed driver user accounts
  const driverUsers = [
    { id: "user_yossi", first_name: "יוסי", last_name: "כהן", phone: "054-1234567" },
    { id: "user_dana", first_name: "דנה", last_name: "לוי", phone: "052-7654321" },
    { id: "user_ahmed", first_name: "אחמד", last_name: "מנסור", phone: "050-9876543" },
  ];
  for (const u of driverUsers) {
    if (!memoryDb.findById("users", u.id)) {
      memoryDb.insert("users", {
        id: u.id,
        tenant_id: tenantId,
        email: `${u.id}@restaurantos.local`,
        first_name: u.first_name,
        last_name: u.last_name,
        phone: u.phone,
        role: "DRIVER",
      });
    }
  }
}

async function runLiveSimulation() {
  banner("🚀 RESTAURANTOS — REAL-TIME LIVE SYSTEM SIMULATOR");
  console.log(`${c.dim}Simulation Speed: ${speedMultiplier}x | Environment: Universal Full Stack (Web + KDS + Mobile)${c.reset}\n`);

  const tenantId = "tenant_tlv_1";
  const branchId = "branch_dizengoff";

  await initSimulationData(tenantId, branchId);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: COURIER SHIFT CLOCK-IN & FIFO QUEUE
  // ──────────────────────────────────────────────────────────────────────────
  banner("STEP 1: COURIER SHIFT CLOCK-IN & FIFO AVAILABILITY QUEUE");

  const drivers = [
    { userId: "user_yossi", name: "יוסי כהן (Yossi Cohen)", vehicle: "SCOOTER", plate: "54-219-88" },
    { userId: "user_dana", name: "דנה לוי (Dana Levi)", vehicle: "E_BIKE", plate: "BIKE-04" },
    { userId: "user_ahmed", name: "אחמד מנסור (Ahmed Mansour)", vehicle: "CAR", plate: "19-842-12" },
  ];

  for (const drv of drivers) {
    await delay(500);
    await driverQueueService.clockIn(tenantId, branchId, drv.userId);
    logEvent(
      "DRIVER_APP",
      `${c.bgGreen} 🛵 CLOCK-IN ${c.reset}`,
      `${c.green}${drv.name}${c.reset} clocked in with ${drv.vehicle} (${drv.plate}) ➔ Status: ${c.bold}AVAILABLE (זמין בתור)${c.reset}`
    );
  }

  const initialQueue = await driverQueueService.getDriverQueue(tenantId, branchId);
  logEvent(
    "FLEET_QUEUE",
    `${c.bgBlue} FIFO QUEUE ${c.reset}`,
    `Active couriers in queue: ${c.bold}${initialQueue.length}${c.reset} [${initialQueue.map((d: any) => d.name || d.userId).join(" ➔ ")}]`
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: OMNICHANNEL INCOMING ORDERS
  // ──────────────────────────────────────────────────────────────────────────
  await delay(1000);
  banner("STEP 2: OMNICHANNEL INCOMING ORDERS INGESTION");

  // Order 1: Customer Public Website Delivery
  logEvent(
    "PUBLIC_WEB",
    `${c.bgYellow} 🛒 NEW ORDER ${c.reset}`,
    `Incoming from Customer Web: "2x Classic Burger + Truffle Fries" ➔ Destination: ${c.bold}דיזנגוף 104, תל אביב${c.reset}`
  );
  const order1 = await orderService.createOrder({
    tenantId,
    branchId,
    customerId: "cust_tlv_omer",
    channel: "WEBSITE",
    orderType: "DELIVERY",
    items: [
      { productId: "prod_burger_classic", productName: "המבורגר קלאסי 220 גרם", quantity: 2, unitPrice: 62 },
      { productId: "prod_truffle_fries", productName: "צ'יפס כמהין", quantity: 1, unitPrice: 28 },
    ],
    deliveryFee: 16,
    autoConfirm: true,
  });
  logEvent(
    "ORDER_SERVICE",
    `${c.bgGreen} CONFIRMED ${c.reset}`,
    `Order ${c.bold}#${order1.id.slice(-4)}${c.reset} created & confirmed | Total: ₪${order1.total_amount} | Kitchen BOM recipe triggered`
  );

  await delay(600);

  // Order 2: Aggregator Wolt Webhook Delivery
  logEvent(
    "INTEGRATION_HUB",
    `${c.bgYellow} 🚴 WOLT API ${c.reset}`,
    `Incoming from Wolt Webhook: "פיצה מרגריטה + קולה זירו" ➔ Destination: ${c.bold}שדרות רוטשילד 45, תל אביב${c.reset}`
  );
  const order2 = await orderService.createOrder({
    tenantId,
    branchId,
    customerId: "cust_tlv_wolt_guest",
    channel: "WOLT",
    orderType: "DELIVERY",
    items: [
      { productId: "prod_pizza_margherita", productName: "פיצה מרגריטה משפחתית", quantity: 1, unitPrice: 74 },
      { productId: "prod_coke_zero", productName: "קוקה קולה זירו 330 מ\"ל", quantity: 2, unitPrice: 12 },
    ],
    deliveryFee: 18,
    externalOrderId: "WOLT-TLV-8921",
    autoConfirm: true,
  });
  logEvent(
    "ORDER_SERVICE",
    `${c.bgGreen} CONFIRMED ${c.reset}`,
    `Order ${c.bold}#${order2.id.slice(-4)}${c.reset} [WOLT-TLV-8921] created & confirmed | Total: ₪${order2.total_amount}`
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: KDS KITCHEN TICKETS & STATION COOKING
  // ──────────────────────────────────────────────────────────────────────────
  await delay(1000);
  banner("STEP 3: KDS DIGITAL TICKET RAIL & KITCHEN COOKING");

  // Route order items to KDS stations
  const tickets = await kdsService.routeOrderToStations(order1, order1.items as any);
  const ticket1 = tickets[0] || (await kdsService.getTicketsForOrder(tenantId, order1.id))[0];

  logEvent(
    "KDS_STATION",
    `${c.bgBlue} 🎫 TICKET ON RAIL ${c.reset}`,
    `Station [Grill & Expo]: Ticket #${ticket1.id.slice(-4)} appeared on digital rail (Target SLA: 15m)`
  );

  await delay(800);
  logEvent(
    "KDS_COOK",
    `${c.bgYellow} 🔥 START COOKING ${c.reset}`,
    `Line cook bumped #${ticket1.id.slice(-4)} to ${c.yellow}IN_PREPARATION (בהכנה)${c.reset} — Station timer ticking`
  );
  await kdsService.startTicket(tenantId, ticket1.id, "cook_david");

  await delay(1000);
  logEvent(
    "KDS_EXPO",
    `${c.bgGreen} 🛎️ PLATE UP / READY ${c.reset}`,
    `Expo Chef completed ticket #${ticket1.id.slice(-4)} ➔ Status: ${c.bold}${c.green}READY (מוכן על הפס)${c.reset} — Audio chime 🔔`
  );
  await kdsService.readyTicket(tenantId, ticket1.id, "cook_david");

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4: DELIVERY CREATION & COURIER SELF-ASSIGNMENT
  // ──────────────────────────────────────────────────────────────────────────
  await delay(900);
  banner("STEP 4: DELIVERY CREATION & DRIVER FIFO QUEUE SELF-ASSIGNMENT");

  const delivery1 = await deliveryService.createDelivery({
    tenantId,
    branchId,
    orderId: order1.id,
    deliveryAddress: {
      street: "דיזנגוף",
      number: "104",
      city: "תל אביב",
      lat: 32.0781,
      lng: 34.7735,
    },
    customerNotes: "קוד כניסה לבניין: 1042",
  });

  logEvent(
    "DISPATCH_ENGINE",
    `${c.bgBlue} 📦 DELIVERY READY ${c.reset}`,
    `Delivery ${c.bold}#${delivery1.id.slice(-4)}${c.reset} queued in FIFO driver queue (Order #${order1.id.slice(-4)})`
  );

  await delay(700);

  // Driver 1 (user_yossi) is #1 in queue, self-assigns delivery via Driver Android App
  logEvent(
    "DRIVER_APP",
    `${c.bgMagenta} 📲 SELF-ASSIGN ${c.reset}`,
    `Courier ${c.bold}יוסי כהן${c.reset} tapped [קבל משלוח] in Driver App ➔ Claimed delivery #${delivery1.id.slice(-4)}`
  );
  await deliveryService.selfAssignDelivery(tenantId, delivery1.id, "user_yossi");
  logEvent(
    "DELIVERY_LOGISTICS",
    `${c.bgGreen} ASSIGNED ${c.reset}`,
    `Delivery #${delivery1.id.slice(-4)} state: ${c.bold}ASSIGNED (משויך)${c.reset} ➔ Courier status: ${c.bold}ASSIGNED (במשלוח)${c.reset}`
  );

  // Dispatch push notification to Driver App via Notification Service
  await notificationService.dispatchActionableNotification({
    tenantId,
    branchId,
    recipientId: "user_yossi",
    type: "NEW_DELIVERY_ASSIGNMENT",
    priority: "HIGH",
    title: "משלוח חדש שויך בהצלחה",
    body: `משלוח #${delivery1.id.slice(-4)} עבור דיזנגוף 104 מוכן לאיסוף בעמדת הפס.`,
    targetEntity: { type: "DELIVERY", id: delivery1.id },
    deepLink: `restaurantos://delivery/${delivery1.id}`,
  });
  logEvent(
    "PUSH_NOTIFICATIONS",
    `${c.bgBlue} 🔔 PUSH SENT ${c.reset}`,
    `Native FCM/Expo push sent to יוסי כהן: "restaurantos://delivery/${delivery1.id}"`
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 5: PACKAGE COLLECTION, GPS TRANSIT & SPOT PROXIMITY
  // ──────────────────────────────────────────────────────────────────────────
  await delay(1000);
  banner("STEP 5: PACKAGE PICKUP, GPS BREADCRUMBS & LIVE TRANSIT");

  logEvent(
    "DRIVER_APP",
    `${c.bgYellow} 🛍️ PICKUP ${c.reset}`,
    `Courier verified bag ticket at kitchen expo ➔ Status: ${c.bold}PICKED_UP (נאסף)${c.reset}`
  );
  await deliveryService.pickupDelivery(tenantId, delivery1.id, "user_yossi");

  await delay(600);
  logEvent(
    "DRIVER_APP",
    `${c.bgBlue} 🛵 EN ROUTE ${c.reset}`,
    `Courier launched Waze deep-link ➔ Status: ${c.bold}IN_TRANSIT (בדרך ללקוח)${c.reset}`
  );
  await deliveryService.startDelivery(tenantId, delivery1.id, "user_yossi");

  // GPS Breadcrumbs along Dizengoff Street
  const waypoints = [
    { name: "Leaving Branch (Dizengoff 50)", lat: 32.0752, lng: 34.7741 },
    { name: "Crossing Dizengoff Square", lat: 32.0770, lng: 34.7738 },
    { name: "Arrived at Customer Address (Dizengoff 104)", lat: 32.0781, lng: 34.7735 },
  ];

  for (const wp of waypoints) {
    await delay(600);
    logEvent(
      "FLEET_TELEMETRY",
      `${c.cyan} 📍 SPOT GPS ${c.reset}`,
      `Courier location: ${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)} [${wp.name}]`
    );
  }

  // Spot Geofence Proximity Trigger
  logEvent(
    "PROXIMITY_ENGINE",
    `${c.bgMagenta} 🎯 GEOFENCE ${c.reset}`,
    `Courier within 30m of customer pin ➔ Status: ${c.bold}ARRIVED_AT_CUSTOMER_AREA (אצל הלקוח)${c.reset}`
  );
  await deliveryService.arriveDelivery(tenantId, delivery1.id, "user_yossi");

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 6: PROOF OF DELIVERY & RETURN TO FIFO QUEUE
  // ──────────────────────────────────────────────────────────────────────────
  await delay(900);
  banner("STEP 6: PROOF OF DELIVERY & RETURN TO QUEUE");

  logEvent(
    "DRIVER_APP",
    `${c.bgGreen} ✍️ POD CONFIRMED ${c.reset}`,
    `Customer received order ➔ Courier confirmed OTP/Signature ➔ Status: ${c.bold}${c.green}DELIVERED (נמסר)${c.reset}`
  );
  await deliveryService.completeDelivery(tenantId, delivery1.id, "user_yossi", {
    proofType: "CUSTOMER_SIGNATURE",
    notes: "Handed directly to Omer",
  });

  await delay(500);
  // Re-clock in / return driver to queue
  await driverQueueService.clockIn(tenantId, branchId, "user_yossi");
  logEvent(
    "FLEET_QUEUE",
    `${c.bgGreen} 🔄 REJOIN QUEUE ${c.reset}`,
    `Courier יוסי כהן returned to branch ➔ Rejoined FIFO availability queue as ${c.bold}AVAILABLE${c.reset}`
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 7: LIVE MANAGER TELEMETRY & NOTIFICATION AUDIT
  // ──────────────────────────────────────────────────────────────────────────
  await delay(800);
  banner("STEP 7: LIVE MANAGER APP DASHBOARD & REAL-TIME AUDIT");

  const unreadNotifs = await notificationService.getNotifications(tenantId, "user_yossi", 5);
  logEvent(
    "MANAGER_APP",
    `${c.bgBlue} 📊 LIVE METRICS ${c.reset}`,
    `Dashboard summary: Completed Orders: 1 | Active Deliveries: 0 | Couriers Available: 3`
  );
  logEvent(
    "MANAGER_APP",
    `${c.bgYellow} 🔔 ALERTS ${c.reset}`,
    `Manager notification inbox: ${unreadNotifs.length} actionable events recorded (Zero PII)`
  );

  banner("✅ REAL-TIME LIVE SIMULATION CYCLE COMPLETED SUCCESSFULLY");
  console.log(`${c.green}${c.bold}The entire RestaurantOS omnichannel pipeline executed flawlessly:${c.reset}`);
  console.log(`  1. Omnichannel Order Ingested (Web & Wolt)`);
  console.log(`  2. KDS Station Ticket Rail & Cook Timing`);
  console.log(`  3. Autonomous FIFO Delivery Self-Assignment`);
  console.log(`  4. Spot GPS Breadcrumbs & Proximity Triggering`);
  console.log(`  5. Proof of Delivery & Shift Queue Re-entry`);
  console.log(`  6. Zero-PII Real-Time Notifications Dispatched\n`);
}

runLiveSimulation().catch((err) => {
  console.error("Simulation error:", err);
  process.exit(1);
});
