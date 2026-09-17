import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { eventBus } from "@/core/events/event-bus";
import { customerService } from "@/modules/crm/services/customer-service";
import { orderService } from "@/modules/orders/services/order-service";
import { menuService } from "@/modules/menu/services/menu-service";
import {
  telephonyService,
  normalizePhoneNumber,
  MockSIPAdapter,
} from "@/modules/telephony";

describe("Phase 7: Telephony PBX Integration & Caller ID Popup", () => {
  const tenantA = "tenant_telephony_test_a";
  const tenantB = "tenant_telephony_test_b";
  const branchMain = "branch_main_tlv";

  beforeEach(() => {
    memoryDb.reset();
  });

  // TEL-001: Israeli Phone Normalization (Mobile & Landline, E.164, and local formatting)
  it("TEL-001: normalizes Israeli mobile and landline numbers accurately to local and E.164", () => {
    // Israeli mobile with dashes
    const res1 = normalizePhoneNumber("052-4455667");
    expect(res1.isValid).toBe(true);
    expect(res1.normalizedLocal).toBe("0524455667");
    expect(res1.e164).toBe("+972524455667");

    // E.164 format with +972
    const res2 = normalizePhoneNumber("+972501234567");
    expect(res2.isValid).toBe(true);
    expect(res2.normalizedLocal).toBe("0501234567");
    expect(res2.e164).toBe("+972501234567");

    // International with 00972
    const res3 = normalizePhoneNumber("0097235550100");
    expect(res3.isValid).toBe(true);
    expect(res3.normalizedLocal).toBe("035550100");
    expect(res3.e164).toBe("+97235550100");

    // Israeli landline Tel Aviv 03
    const res4 = normalizePhoneNumber("03-6201234");
    expect(res4.isValid).toBe(true);
    expect(res4.normalizedLocal).toBe("036201234");
    expect(res4.e164).toBe("+97236201234");

    // Invalid format
    const res5 = normalizePhoneNumber("123");
    expect(res5.isValid).toBe(false);
  });

  // TEL-002: Incoming Call with Existing Customer (Full Caller ID Popup payload)
  it("TEL-002: generates full Caller ID popup payload when existing customer calls", async () => {
    // 1. Pre-register customer in CRM
    const customer = await customerService.createCustomer(tenantA, {
      phone: "0524455667",
      firstName: "דניאל",
      lastName: "גולדשטיין",
      allergies: ["בוטנים"],
      internalNotes: "אוהב רוטב שום כפול",
    });

    // 2. Add an address
    await customerService.addAddress(tenantA, customer.id, {
      street: "רוטשילד",
      houseNumber: "45",
      city: "תל אביב",
      isDefault: true,
    });

    // 3. Handle incoming call webhook from PBX
    const sessionId = "call_session_001";
    const result = await telephonyService.handleIncomingCall(
      tenantA,
      {
        sessionId,
        callerNumber: "052-4455667",
        direction: "INBOUND",
      },
      { branchId: branchMain }
    );

    expect(result.callerId).toBeDefined();
    expect(result.callerId.callSessionId).toBe(sessionId);
    expect(result.callerId.status).toBe("RINGING");
    expect(result.callerId.callerNumber).toBe("0524455667");
    expect(result.callerId.customer).not.toBeNull();
    expect(result.callerId.customer?.firstName).toBe("דניאל");
    expect(result.callerId.customer?.allergies).toContain("בוטנים");
    expect(result.callerId.customer?.internalNotes).toBe("אוהב רוטב שום כפול");

    // Verify address is attached
    expect(result.callerId.savedAddresses.length).toBe(1);
    expect(result.callerId.savedAddresses[0].street).toBe("רוטשילד");

    // Verify call log recorded in DB
    const log = await telephonyService.getCallLogBySessionId(tenantA, sessionId);
    expect(log).not.toBeNull();
    expect(log?.customer_id).toBe(customer.id);
    expect(log?.status).toBe("RINGING");
    expect(log?.automated_greeting_played).toBe(true);
  });

  // TEL-003: Incoming Call with Unknown Customer
  it("TEL-003: handles unknown caller gracefully with null customer summary", async () => {
    const sessionId = "call_session_unknown_99";
    const result = await telephonyService.handleIncomingCall(
      tenantA,
      {
        sessionId,
        callerNumber: "0549988771",
        direction: "INBOUND",
      },
      { branchId: branchMain }
    );

    expect(result.callerId.customer).toBeNull();
    expect(result.callerId.recentOrders).toEqual([]);
    expect(result.callerId.savedAddresses).toEqual([]);
    expect(result.callLog.customer_id).toBeNull();
    expect(result.callLog.status).toBe("RINGING");
  });

  // TEL-004: Multi-Tenant Isolation
  it("TEL-004: strictly isolates customer data across tenants during caller ID lookup", async () => {
    // Customer registered in Tenant B
    await customerService.createCustomer(tenantB, {
      phone: "0501122334",
      firstName: "יוסי",
      lastName: "כהן",
    });

    // Same phone rings in Tenant A
    const result = await telephonyService.handleIncomingCall(
      tenantA,
      {
        sessionId: "session_iso_1",
        callerNumber: "0501122334",
      },
      { branchId: branchMain }
    );

    // Tenant A MUST NOT see Tenant B's customer
    expect(result.callerId.customer).toBeNull();
    expect(result.callLog.customer_id).toBeNull();
  });

  // TEL-005: Webhook Idempotency
  it("TEL-005: achieves idempotency on duplicate incoming webhook payloads", async () => {
    const sessionId = "session_idempotent_101";

    const res1 = await telephonyService.handleIncomingCall(tenantA, {
      sessionId,
      callerNumber: "0509988111",
    });

    const res2 = await telephonyService.handleIncomingCall(tenantA, {
      sessionId,
      callerNumber: "0509988111",
    });

    expect(res1.callLog.id).toBe(res2.callLog.id);
    const logs = await telephonyService.getCallLogs(tenantA);
    const matches = logs.filter((l) => l.call_session_id === sessionId);
    expect(matches.length).toBe(1);
  });

  // TEL-006: Call Status Transitions (RINGING -> ANSWERED -> COMPLETED)
  it("TEL-006: updates call log upon answer and completion events", async () => {
    const sessionId = "session_lifecycle_202";

    // 1. Ringing
    await telephonyService.handleIncomingCall(tenantA, {
      sessionId,
      callerNumber: "0521234567",
    });

    // 2. Answered
    const answeredLog = await telephonyService.handleCallStatusUpdate(tenantA, {
      sessionId,
      status: "ANSWERED",
      operatorId: "usr_operator_1",
      timestamp: "2026-09-15T16:20:00Z",
    });

    expect(answeredLog?.status).toBe("ANSWERED");
    expect(answeredLog?.operator_id).toBe("usr_operator_1");
    expect(answeredLog?.answered_at).toBe("2026-09-15T16:20:00Z");

    // 3. Completed
    const completedLog = await telephonyService.handleCallStatusUpdate(tenantA, {
      sessionId,
      status: "COMPLETED",
      durationSeconds: 145,
      timestamp: "2026-09-15T16:22:25Z",
    });

    expect(completedLog?.status).toBe("COMPLETED");
    expect(completedLog?.duration_seconds).toBe(145);
    expect(completedLog?.ended_at).toBe("2026-09-15T16:22:25Z");
  });

  // TEL-007: Domain Event Publication (call.ringing, call.answered, call.ended)
  it("TEL-007: publishes typed domain events for outbox and real-time distribution", async () => {
    let ringingEventEmitted = false;
    let endedEventEmitted = false;

    eventBus.subscribe("call.ringing", (event) => {
      if (event.correlationId === "session_event_303") {
        ringingEventEmitted = true;
      }
    });

    eventBus.subscribe("call.ended", (event) => {
      if (event.correlationId === "session_event_303") {
        endedEventEmitted = true;
      }
    });

    const sessionId = "session_event_303";
    await telephonyService.handleIncomingCall(tenantA, {
      sessionId,
      callerNumber: "0523344556",
    });

    expect(ringingEventEmitted).toBe(true);

    await telephonyService.handleCallStatusUpdate(tenantA, {
      sessionId,
      status: "COMPLETED",
      durationSeconds: 60,
    });

    expect(endedEventEmitted).toBe(true);
  });

  // TEL-008: Call History and Query Filters
  it("TEL-008: filters call history by branch, status, and customer", async () => {
    const cust = await customerService.createCustomer(tenantA, {
      phone: "0547778899",
      firstName: "רונית",
      lastName: "אברהם",
    });

    await telephonyService.handleIncomingCall(
      tenantA,
      { sessionId: "s1", callerNumber: "0547778899" },
      { branchId: "branch_north" }
    );
    await telephonyService.handleIncomingCall(
      tenantA,
      { sessionId: "s2", callerNumber: "0500000000" },
      { branchId: "branch_south" }
    );

    const northLogs = await telephonyService.getCallLogs(tenantA, { branchId: "branch_north" });
    expect(northLogs.length).toBe(1);
    expect(northLogs[0].call_session_id).toBe("s1");

    const custLogs = await telephonyService.getCallLogs(tenantA, { customerId: cust.id });
    expect(custLogs.length).toBe(1);
    expect(custLogs[0].call_session_id).toBe("s1");
  });

  // TEL-009: Israeli Regulatory Automated Greeting Compliance
  it("TEL-009: sets automated_greeting_played to true adhering to Israeli telephony regulations", async () => {
    const result = await telephonyService.handleIncomingCall(tenantA, {
      sessionId: "session_regulatory_404",
      callerNumber: "0529988776",
    });

    expect(result.callLog.automated_greeting_played).toBe(true);
  });

  // TEL-010: Adapter Extensibility (MockSIPAdapter signature & payload translation)
  it("TEL-010: allows custom adapter replacement and verifies adapter translation", () => {
    const adapter = new MockSIPAdapter();
    expect(adapter.providerName).toBe("MOCK_SIP");

    const twilioLikePayload = {
      CallSid: "CA1234567890",
      From: "+972501112233",
      To: "+97235550100",
      direction: "INBOUND",
    };

    const parsed = adapter.parseIncomingCallPayload(twilioLikePayload);
    expect(parsed.sessionId).toBe("CA1234567890");
    expect(parsed.callerNumber).toBe("+972501112233");

    const statusPayload = {
      CallSid: "CA1234567890",
      CallStatus: "completed",
      durationSeconds: 88,
    };
    const parsedStatus = adapter.parseStatusPayload(statusPayload);
    expect(parsedStatus.status).toBe("COMPLETED");
    expect(parsedStatus.durationSeconds).toBe(88);
  });
});
