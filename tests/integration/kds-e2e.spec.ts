import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { memoryDb } from "@/core/database/db";
import { kdsService } from "@/modules/kds/services/kds-service";

import { GET as getTicketsRoute } from "@/app/api/v1/kds/tickets/route";
import { POST as startRoute } from "@/app/api/v1/kds/tickets/[id]/start/route";
import { POST as readyRoute } from "@/app/api/v1/kds/tickets/[id]/ready/route";
import { POST as bumpRoute } from "@/app/api/v1/kds/tickets/[id]/bump/route";
import { POST as recallRoute } from "@/app/api/v1/kds/tickets/[id]/recall/route";
import { GET as streamRoute } from "@/app/api/v1/kds/stream/route";
import { POST as issueRealtimeTicketRoute } from "@/app/api/v1/realtime/ticket/route";

describe("KDS End-to-End Client & Stream Integration", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const cookUserId = "c0ccd37f-a43a-4365-9093-d4158ee0f749";
  const cookToken = "valid_cook_test_token";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();

    // Insert active session for seeded user (has OWNER role on this branch)
    memoryDb.insert("sessions", {
      id: "sess_cook_valid",
      user_id: cookUserId,
      token: cookToken,
      role: "OWNER",
      tenant_id: tenantId,
      organization_id: tenantId,
      branch_id: branchId,
      expires_at: new Date(Date.now() + 86400000),
      is_active: true,
      created_at: new Date(),
    });
  });

  describe("API Action Routes Lifecycle (Start -> Ready -> Bump -> Recall)", () => {
    it("should process full ticket lifecycle through REST route handlers", async () => {
      const ticketId = "kds-tkt-01-burgers";

      // 1. GET initial active tickets
      const getReq = new NextRequest(`http://localhost:3000/api/v1/kds/tickets?branchId=${branchId}`, {
        headers: {
          authorization: `Bearer ${cookToken}`,
          "x-branch-id": branchId,
        },
      });
      const getRes = await getTicketsRoute(getReq);
      expect(getRes.status).toBe(200);
      const initialData = await getRes.json();
      expect(initialData.tickets.some((t: any) => t.id === ticketId)).toBe(true);

      // 2. Start ticket
      const startReq = new NextRequest(`http://localhost:3000/api/v1/kds/tickets/${ticketId}/start`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${cookToken}`,
          "x-branch-id": branchId,
        },
      });
      const startRes = await startRoute(startReq, { params: Promise.resolve({ id: ticketId }) });
      expect(startRes.status).toBe(200);
      const startData = await startRes.json();
      expect(startData.ticket.status).toBe("STARTED");
      expect(startData.ticket.started_at).toBeDefined();

      // 3. Mark Ready
      const readyReq = new NextRequest(`http://localhost:3000/api/v1/kds/tickets/${ticketId}/ready`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${cookToken}`,
          "x-branch-id": branchId,
        },
      });
      const readyRes = await readyRoute(readyReq, { params: Promise.resolve({ id: ticketId }) });
      expect(readyRes.status).toBe(200);
      const readyData = await readyRes.json();
      expect(readyData.ticket.status).toBe("READY");

      // 4. Bump ticket (completes and removes from active rail)
      const bumpReq = new NextRequest(`http://localhost:3000/api/v1/kds/tickets/${ticketId}/bump`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${cookToken}`,
          "x-branch-id": branchId,
        },
      });
      const bumpRes = await bumpRoute(bumpReq, { params: Promise.resolve({ id: ticketId }) });
      expect(bumpRes.status).toBe(200);
      const bumpData = await bumpRes.json();
      expect(bumpData.ticket.status).toBe("COMPLETED");

      // Verify it is no longer returned in default active tickets query
      const postBumpGet = await getTicketsRoute(getReq);
      const postBumpData = await postBumpGet.json();
      expect(postBumpData.tickets.some((t: any) => t.id === ticketId)).toBe(false);

      // 5. Recall ticket back to rail
      const recallReq = new NextRequest(`http://localhost:3000/api/v1/kds/tickets/${ticketId}/recall`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${cookToken}`,
          "x-branch-id": branchId,
        },
      });
      const recallRes = await recallRoute(recallReq, { params: Promise.resolve({ id: ticketId }) });
      expect(recallRes.status).toBe(200);
      const recallData = await recallRes.json();
      expect(recallData.ticket.status).toBe("RECALLED");

      // Verify it reappears in active tickets query
      const postRecallGet = await getTicketsRoute(getReq);
      const postRecallData = await postRecallGet.json();
      expect(postRecallData.tickets.some((t: any) => t.id === ticketId)).toBe(true);
    });
  });

  describe("Realtime SSE Stream & EventBus Bridge", () => {
    it("should stream initial state and push live domain events without memory leak", async () => {
      // 1. Issue ephemeral token
      const issueReq = new NextRequest("http://localhost:3000/api/v1/realtime/ticket", {
        method: "POST",
        headers: {
          authorization: `Bearer ${cookToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchId }),
      });
      const issueRes = await issueRealtimeTicketRoute(issueReq);
      expect(issueRes.status).toBe(201);
      const { ticket: ephemeralToken } = await issueRes.json();

      // 2. Connect to SSE stream
      const abortController = new AbortController();
      const streamReq = new NextRequest(
        `http://localhost:3000/api/v1/kds/stream?ticket=${encodeURIComponent(ephemeralToken)}`,
        { signal: abortController.signal }
      );

      const streamResponse = await streamRoute(streamReq);
      expect(streamResponse.status).toBe(200);
      expect(streamResponse.headers.get("content-type")).toBe("text/event-stream");

      const reader = streamResponse.body!.getReader();
      const decoder = new TextDecoder();

      // Read handshake
      const chunk1 = await reader.read();
      const text1 = decoder.decode(chunk1.value);
      expect(text1).toContain("event: connected");

      // Read initial state
      const chunk2 = await reader.read();
      const text2 = decoder.decode(chunk2.value);
      expect(text2).toContain("event: initial_state");
      expect(text2).toContain("kds-tkt-01-burgers");

      // 3. Emit a live KDS domain event via kdsService (simulating cook action)
      await kdsService.startTicket(tenantId, "kds-tkt-01-burgers", cookUserId);

      // Read streamed live update
      const chunk3 = await reader.read();
      const text3 = decoder.decode(chunk3.value);
      expect(text3).toContain("event: ticket_updated");
      expect(text3).toContain("KDSTicketStarted");
      expect(text3).toContain("kds-tkt-01-burgers");

      // 4. Abort stream and verify clean teardown
      abortController.abort();
      await reader.cancel();

      // Ephemeral token cannot be reused
      const replayReq = new NextRequest(
        `http://localhost:3000/api/v1/kds/stream?ticket=${encodeURIComponent(ephemeralToken)}`
      );
      const replayRes = await streamRoute(replayReq);
      expect(replayRes.status).toBe(401);
    });

    it("should reject unauthenticated stream connections", async () => {
      const streamReq = new NextRequest("http://localhost:3000/api/v1/kds/stream");
      const res = await streamRoute(streamReq);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("ephemeral connection ticket required");
    });
  });

  describe("Security & Station Filtering", () => {
    it("should filter tickets by stationId when requested", async () => {
      const burgersReq = new NextRequest(
        `http://localhost:3000/api/v1/kds/tickets?branchId=${branchId}&stationId=st-01-burgers`,
        {
          headers: {
            authorization: `Bearer ${cookToken}`,
          },
        }
      );
      const burgersRes = await getTicketsRoute(burgersReq);
      expect(burgersRes.status).toBe(200);
      const burgersData = await burgersRes.json();
      expect(Array.isArray(burgersData.tickets)).toBe(true);

      for (const t of burgersData.tickets) {
        expect(t.station_id).toBe("st-01-burgers");
      }
    });

    it("should reject ticket actions when user lacks required permission", async () => {
      // Create user and session with CASHIER role (lacks kds.bump)
      const cashierId = "cashier-test-user";
      memoryDb.insert("users", {
        id: cashierId,
        tenant_id: tenantId,
        email: "cashier@test.com",
        is_active: true,
      });
      memoryDb.insert("user_branch_assignments", {
        user_id: cashierId,
        organization_id: tenantId,
        branch_id: branchId,
        role: "CASHIER",
        is_primary: true,
      });
      memoryDb.insert("sessions", {
        id: "sess_cashier",
        user_id: cashierId,
        token: "valid_cashier_token",
        role: "CASHIER",
        tenant_id: tenantId,
        organization_id: tenantId,
        branch_id: branchId,
        expires_at: new Date(Date.now() + 86400000),
        is_active: true,
        created_at: new Date(),
      });

      const bumpReq = new NextRequest(
        "http://localhost:3000/api/v1/kds/tickets/kds-tkt-01-burgers/bump",
        {
          method: "POST",
          headers: {
            authorization: `Bearer valid_cashier_token`,
          },
        }
      );
      const bumpRes = await bumpRoute(bumpReq, { params: Promise.resolve({ id: "kds-tkt-01-burgers" }) });
      expect(bumpRes.status).toBe(403);
    });
  });
});
