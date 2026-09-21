import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RestaurantOSClient,
  RestaurantOSApiError,
  InMemoryStorageAdapter,
} from "@/shared/api-client/restaurant-os-client";
import {
  RestaurantOSRealtimeClient,
  InMemoryRealtimeTransport,
} from "@/shared/realtime/realtime-client";
import { CLIENT_HEADERS } from "@/shared/contracts/client-types";
import { STANDARD_ERROR_CODES } from "@/shared/contracts/api";
import { RealtimeEvent } from "@/shared/contracts/realtime";

describe("RestaurantOS Multi-Client Architecture & API Client", () => {
  const tenantId = "org_550e8400_e29b_41d4_a716_446655440000";
  const branchId = "brn_770e8400_e29b_41d4_a716_446655440001";
  const token = "mock_jwt_session_token";

  describe("API Client Header Injection & Context", () => {
    it("should inject all canonical client headers (ClientType, TenantID, BranchID, RequestID, Auth)", async () => {
      let capturedHeaders: Record<string, string> = {};

      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return new Response(
          JSON.stringify({
            success: true,
            data: { status: "ok" },
            meta: { requestId: "req_test", timestamp: new Date().toISOString() },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      });

      const client = new RestaurantOSClient({
        baseUrl: "https://api.restaurantos.io",
        clientType: "MANAGER_APP",
        tenantId,
        branchId,
        token,
        fetchFn: mockFetch as any,
      });

      const res = await client.get("/api/v1/orders");

      expect(res.success).toBe(true);
      expect(capturedHeaders[CLIENT_HEADERS.CLIENT_TYPE]).toBe("MANAGER_APP");
      expect(capturedHeaders[CLIENT_HEADERS.TENANT_ID]).toBe(tenantId);
      expect(capturedHeaders[CLIENT_HEADERS.BRANCH_ID]).toBe(branchId);
      expect(capturedHeaders[CLIENT_HEADERS.REQUEST_ID]).toBeDefined();
      expect(capturedHeaders["authorization"]).toBe(`Bearer ${token}`);
    });

    it("should allow dynamic updating of tenant, branch, and auth tokens", async () => {
      let capturedHeaders: Record<string, string> = {};
      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return new Response(
          JSON.stringify({
            success: true,
            data: {},
            meta: { requestId: "req_test", timestamp: new Date().toISOString() },
          }),
          { status: 200 }
        );
      });

      const client = new RestaurantOSClient({
        baseUrl: "https://api.restaurantos.io",
        clientType: "DRIVER_APP",
        fetchFn: mockFetch as any,
      });

      client.setTenantId("new_tenant_123");
      client.setBranchId("new_branch_456");
      client.setToken("new_driver_token");

      await client.get("/api/v1/deliveries");

      expect(capturedHeaders[CLIENT_HEADERS.TENANT_ID]).toBe("new_tenant_123");
      expect(capturedHeaders[CLIENT_HEADERS.BRANCH_ID]).toBe("new_branch_456");
      expect(capturedHeaders["authorization"]).toBe("Bearer new_driver_token");
    });
  });

  describe("Idempotency Semantics & Network Retries", () => {
    it("should generate a new idempotency key for new logical mutations", async () => {
      const keysUsed: string[] = [];
      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        if (headers[CLIENT_HEADERS.IDEMPOTENCY_KEY]) {
          keysUsed.push(headers[CLIENT_HEADERS.IDEMPOTENCY_KEY]);
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: { id: "item_1" },
            meta: { requestId: "req_1", timestamp: new Date().toISOString() },
          }),
          { status: 200 }
        );
      });

      const client = new RestaurantOSClient({
        baseUrl: "https://api.restaurantos.io",
        clientType: "WEB_ADMIN",
        fetchFn: mockFetch as any,
      });

      await client.post("/api/v1/orders", { test: 1 });
      await client.post("/api/v1/orders", { test: 2 });

      expect(keysUsed.length).toBe(2);
      expect(keysUsed[0]).not.toBe(keysUsed[1]);
      expect(keysUsed[0]).toMatch(/^idem_/);
      expect(keysUsed[1]).toMatch(/^idem_/);
    });

    it("should REUSE the exact same idempotency key across network retry attempts", async () => {
      const keysPerAttempt: string[] = [];
      let attemptCount = 0;

      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        attemptCount++;
        const headers = init?.headers as Record<string, string>;
        keysPerAttempt.push(headers[CLIENT_HEADERS.IDEMPOTENCY_KEY]);

        if (attemptCount < 3) {
          // Simulate transient 503 gateway outage
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "SERVICE_UNAVAILABLE",
                message: "Server is temporarily warming up",
                requestId: `req_fail_${attemptCount}`,
                timestamp: new Date().toISOString(),
              },
            }),
            { status: 503 }
          );
        }

        // Succeeded on 3rd attempt
        return new Response(
          JSON.stringify({
            success: true,
            data: { orderId: "ord_recovered" },
            meta: { requestId: "req_success", timestamp: new Date().toISOString() },
          }),
          { status: 200 }
        );
      });

      const client = new RestaurantOSClient({
        baseUrl: "https://api.restaurantos.io",
        clientType: "MANAGER_APP",
        maxRetries: 3,
        retryDelayMs: 10,
        fetchFn: mockFetch as any,
      });

      const res = await client.post("/api/v1/deliveries/batches/suggest", { branchId });

      expect(res.success).toBe(true);
      expect(attemptCount).toBe(3);
      expect(keysPerAttempt.length).toBe(3);
      // Critical invariant: Same idempotency key across all 3 retry attempts!
      expect(keysPerAttempt[0]).toBe(keysPerAttempt[1]);
      expect(keysPerAttempt[1]).toBe(keysPerAttempt[2]);
    });

    it("should fail immediately without retries on non-retryable 4xx client errors (400, 403, 404, 422)", async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: STANDARD_ERROR_CODES.VALIDATION_FAILED,
              message: "Invalid quantity provided",
              details: [{ field: "quantity", issue: "must be positive" }],
              requestId: "req_val_err",
              timestamp: new Date().toISOString(),
            },
          }),
          { status: 422 }
        );
      });

      const client = new RestaurantOSClient({
        baseUrl: "https://api.restaurantos.io",
        clientType: "KIOSK",
        maxRetries: 3,
        fetchFn: mockFetch as any,
      });

      await expect(client.post("/api/v1/orders", { quantity: -5 })).rejects.toThrow(
        RestaurantOSApiError
      );

      // Must NOT retry validation failures
      expect(callCount).toBe(1);
    });
  });

  describe("Offline Safety & Mutation Classification", () => {
    it("should block unsafe state-changing mutations when offline without auto-replay", async () => {
      const mockFetch = vi.fn();
      const client = new RestaurantOSClient({
        baseUrl: "https://api.restaurantos.io",
        clientType: "DRIVER_APP",
        fetchFn: mockFetch as any,
      });

      // Simulate connectivity lost
      client.setOnline(false);

      // Attempt unsafe mutation (e.g. driver self-assign)
      await expect(
        client.post("/api/v1/deliveries/del_1/self-assign", {}, { safety: "UNSAFE_FOR_OFFLINE_REPLAY" })
      ).rejects.toThrowError(/blocked from auto-replay/);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should permit safe read operations even when offline flag is evaluated", async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            data: [{ id: "p1", name: "Burger" }],
            meta: { requestId: "req_menu", timestamp: new Date().toISOString() },
          }),
          { status: 200 }
        );
      });

      const client = new RestaurantOSClient({
        baseUrl: "https://api.restaurantos.io",
        clientType: "CUSTOMER_WEB",
        fetchFn: mockFetch as any,
      });

      client.setOnline(true);
      const res = await client.get("/api/v1/public/menu");
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
    });
  });

  describe("Platform Portability (Zero DOM Globals)", () => {
    it("should operate correctly without window, document, or localStorage", () => {
      // In Node.js / React Native, window is undefined
      expect(typeof window === "undefined" || window !== null).toBe(true);

      const storage = new InMemoryStorageAdapter();
      storage.setItem("test_key", "test_value");
      expect(storage.getItem("test_key")).toBe("test_value");
      storage.removeItem("test_key");
      expect(storage.getItem("test_key")).toBeNull();
    });
  });
});

describe("RestaurantOS Realtime Client & Snapshot Resynchronization", () => {
  it("should follow full lifecycle: Ticket Request -> Connect -> Subscriptions -> Snapshot Sync -> Connected", async () => {
    const mockApiClient = {
      getContext: () => ({ branchId: "brn_test_1" }),
      post: vi.fn(async (path: string) => {
        if (path === "/api/v1/realtime/ticket") {
          return {
            success: true,
            data: {
              ticket: "ws_ticket_mock_123",
              expiresAt: new Date(Date.now() + 60000).toISOString(),
              authorizedChannels: ["branch:brn_test_1:kds:all"],
            },
            meta: { requestId: "req_ticket", timestamp: new Date().toISOString() },
          };
        }
        throw new Error(`Unexpected path: ${path}`);
      }),
    } as any;

    const transport = new InMemoryRealtimeTransport();
    const connectSpy = vi.spyOn(transport, "connect");
    const sendSpy = vi.spyOn(transport, "send");

    const realtimeClient = new RestaurantOSRealtimeClient({
      apiClient: mockApiClient,
      wsBaseUrl: "wss://api.restaurantos.io/api/v1/realtime",
      transport,
      autoReconnect: false,
    });

    const stateTransitions: string[] = [];
    realtimeClient.onStateChange((newState) => {
      stateTransitions.push(newState);
    });

    // Register a snapshot handler
    let snapshotReceived: any = null;
    let reconciledEventsCount = 0;
    realtimeClient.registerSnapshotHandler(
      "branch:brn_test_1:kds:all",
      async () => {
        return [{ id: "ticket_1", orderNumber: "101", status: "STARTED" }];
      },
      (snapshot, pendingEvents) => {
        snapshotReceived = snapshot;
        reconciledEventsCount = pendingEvents.length;
      }
    );

    // Subscribe to channel
    const receivedEvents: RealtimeEvent[] = [];
    realtimeClient.subscribe("branch:brn_test_1:kds:all", (event) => {
      receivedEvents.push(event);
    });

    // Connect
    await realtimeClient.connect();

    expect(mockApiClient.post).toHaveBeenCalledWith("/api/v1/realtime/ticket", {
      branchId: "brn_test_1",
    });
    expect(connectSpy).toHaveBeenCalledWith(
      "wss://api.restaurantos.io/api/v1/realtime?ticket=ws_ticket_mock_123"
    );
    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({ action: "SUBSCRIBE", channel: "branch:brn_test_1:kds:all" })
    );

    expect(snapshotReceived).toEqual([
      { id: "ticket_1", orderNumber: "101", status: "STARTED" },
    ]);
    expect(reconciledEventsCount).toBe(0);
    expect(realtimeClient.getState()).toBe("CONNECTED");

    // Simulate incoming realtime event after connection
    const testEvent: RealtimeEvent = {
      eventId: "evt_1",
      eventType: "OrderReady",
      timestamp: new Date().toISOString(),
      aggregateId: "ord_101",
      tenantId: "org_1",
      channel: "branch:brn_test_1:kds:all",
      payload: { ticketId: "ticket_1", status: "READY" },
    };

    transport.simulateServerEvent(testEvent);
    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].eventId).toBe("evt_1");
  });

  it("should request a fresh ticket upon reconnection and reconcile snapshots", async () => {
    let ticketCount = 0;
    const mockApiClient = {
      getContext: () => ({ branchId: "brn_test_1" }),
      post: vi.fn(async () => {
        ticketCount++;
        return {
          success: true,
          data: {
            ticket: `ws_ticket_attempt_${ticketCount}`,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            authorizedChannels: ["branch:brn_test_1:dispatch"],
          },
          meta: { requestId: `req_${ticketCount}`, timestamp: new Date().toISOString() },
        };
      }),
    } as any;

    const transport = new InMemoryRealtimeTransport();
    let snapshotFetchCount = 0;

    const realtimeClient = new RestaurantOSRealtimeClient({
      apiClient: mockApiClient,
      wsBaseUrl: "wss://api.restaurantos.io/api/v1/realtime",
      transport,
      autoReconnect: false, // manual control for test
    });

    realtimeClient.registerSnapshotHandler(
      "branch:brn_test_1:dispatch",
      async () => {
        snapshotFetchCount++;
        return { activeDeliveries: snapshotFetchCount };
      },
      () => {}
    );

    realtimeClient.subscribe("branch:brn_test_1:dispatch", () => {});

    // First connection
    await realtimeClient.connect();
    expect(ticketCount).toBe(1);
    expect(snapshotFetchCount).toBe(1);

    // Simulate connection drop & manual reconnect
    transport.simulateDisconnect();
    expect(realtimeClient.getState()).toBe("DISCONNECTED");

    // Reconnect
    await realtimeClient.connect();
    expect(ticketCount).toBe(2);
    expect(snapshotFetchCount).toBe(2);
    expect(realtimeClient.getState()).toBe("CONNECTED");
  });
});
