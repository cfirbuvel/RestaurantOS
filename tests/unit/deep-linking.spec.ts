import { describe, it, expect } from "vitest";
import { DeepLinkResolver } from "@/shared/deep-linking/deep-link-resolver";

describe("Phase 17 — Deep Linking Protocol & Resolver Unit Tests", () => {
  describe("1. Canonical URI Parsing", () => {
    it("parses delivery deep link", () => {
      const parsed = DeepLinkResolver.parse("restaurantos://delivery/del_12345");
      expect(parsed.scheme).toBe("restaurantos");
      expect(parsed.entity).toBe("delivery");
      expect(parsed.targetEntityType).toBe("DELIVERY");
      expect(parsed.targetId).toBe("del_12345");
    });

    it("parses order deep link", () => {
      const parsed = DeepLinkResolver.parse("restaurantos://order/ord_abc99");
      expect(parsed.targetEntityType).toBe("ORDER");
      expect(parsed.targetId).toBe("ord_abc99");
    });

    it("parses compound kds ticket deep link", () => {
      const parsed = DeepLinkResolver.parse("restaurantos://kds/ticket/tkt_expo_01?branchId=br_west");
      expect(parsed.targetEntityType).toBe("KDS_TICKET");
      expect(parsed.targetId).toBe("tkt_expo_01");
      expect(parsed.queryParams?.branchId).toBe("br_west");
    });

    it("parses driver deep link", () => {
      const parsed = DeepLinkResolver.parse("restaurantos://driver/drv_42");
      expect(parsed.targetEntityType).toBe("DRIVER");
      expect(parsed.targetId).toBe("drv_42");
    });

    it("parses alert deep link", () => {
      const parsed = DeepLinkResolver.parse("restaurantos://alert/alt_printer_offline");
      expect(parsed.targetEntityType).toBe("ALERT");
      expect(parsed.targetId).toBe("alt_printer_offline");
    });
  });

  describe("2. Bidirectional URI Building", () => {
    it("builds valid canonical URIs with parameters", () => {
      const uri = DeepLinkResolver.buildUri("delivery", "del_777", { reason: "reassigned" });
      expect(uri).toBe("restaurantos://delivery/del_777?reason=reassigned");
    });

    it("builds KDS ticket deep link", () => {
      const uri = DeepLinkResolver.buildUri("kds/ticket", "tkt_123", { stationId: "station_grill" });
      expect(uri).toBe("restaurantos://kds/ticket/tkt_123?stationId=station_grill");
    });
  });

  describe("3. Multi-Client Route Resolution", () => {
    it("resolves delivery deep link to Web, Manager Android, and Driver Android", () => {
      const resolution = DeepLinkResolver.resolve("restaurantos://delivery/del_990");

      // Web Admin
      expect(resolution.web.searchParams.tab).toBe("dispatch");
      expect(resolution.web.searchParams.deliveryId).toBe("del_990");

      // Manager Android
      expect(resolution.managerApp.tab).toBe("deliveries");
      expect(resolution.managerApp.entityId).toBe("del_990");

      // Driver Android
      expect(resolution.driverApp.screen).toBe("delivery");
      expect(resolution.driverApp.deliveryId).toBe("del_990");
    });

    it("resolves order deep link to Web, Manager Android, and Driver Android", () => {
      const resolution = DeepLinkResolver.resolve("restaurantos://order/ord_444");

      // Web Admin
      expect(resolution.web.searchParams.tab).toBe("orders");
      expect(resolution.web.searchParams.orderId).toBe("ord_444");

      // Manager Android
      expect(resolution.managerApp.tab).toBe("orders");
      expect(resolution.managerApp.entityId).toBe("ord_444");

      // Driver Android (order queue)
      expect(resolution.driverApp.screen).toBe("queue");
      expect(resolution.driverApp.deliveryId).toBe("ord_444");
    });

    it("resolves KDS ticket deep link to Web, Manager Android, and KDS View", () => {
      const resolution = DeepLinkResolver.resolve("restaurantos://kds/ticket/tkt_555?branchId=branch_east");

      // Web
      expect(resolution.web.path).toBe("/kds/branch_east");
      expect(resolution.web.searchParams.ticketId).toBe("tkt_555");

      // Manager Android
      expect(resolution.managerApp.tab).toBe("kds");
      expect(resolution.managerApp.entityId).toBe("tkt_555");

      // KDS
      expect(resolution.kds.branchId).toBe("branch_east");
      expect(resolution.kds.ticketId).toBe("tkt_555");
    });
  });

  describe("4. Security & Error Handling", () => {
    it("rejects foreign schemes like http or javascript", () => {
      expect(() => DeepLinkResolver.parse("https://malicious.com/delivery/123")).toThrow("Invalid deep link scheme");
      expect(() => DeepLinkResolver.parse("javascript:alert(1)")).toThrow("Invalid deep link scheme");
      expect(() => DeepLinkResolver.parse("custom://delivery/123")).toThrow("Invalid deep link scheme");
    });

    it("rejects path traversal and script injection in targetId", () => {
      expect(() => DeepLinkResolver.parse("restaurantos://delivery/../secret")).toThrow("Invalid target ID characters");
      expect(() => DeepLinkResolver.parse("restaurantos://delivery/<script>")).toThrow("Invalid target ID characters");
      expect(() => DeepLinkResolver.parse("restaurantos://delivery/del 123")).toThrow("Invalid target ID characters");
    });

    it("isValid helper method returns boolean safely", () => {
      expect(DeepLinkResolver.isValid("restaurantos://delivery/del_valid_1")).toBe(true);
      expect(DeepLinkResolver.isValid("restaurantos://unknown/del_valid_1")).toBe(false);
      expect(DeepLinkResolver.isValid("not_a_uri")).toBe(false);
    });
  });
});
