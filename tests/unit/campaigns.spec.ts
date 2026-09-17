import { describe, it, expect, beforeEach } from "vitest";
import { CampaignService, MockCampaignDispatcher } from "../../src/modules/marketing/services/campaign-service";
import { canTransitionCampaign } from "../../src/modules/marketing/domain/marketing";
import type { CampaignStatus } from "../../src/modules/marketing/domain/marketing";

describe("Phase 6: Campaign Lifecycle & State Machine", () => {
  let service: CampaignService;
  const tenantId = "org_tenant_campaigns";

  beforeEach(() => {
    service = new CampaignService(new MockCampaignDispatcher());
  });

  // ---------------------------------------------------------------------------
  // Campaign Creation
  // ---------------------------------------------------------------------------

  it("should create a campaign in DRAFT status with tenant scoping", () => {
    const campaign = service.createCampaign(tenantId, {
      name: "Summer Discount",
      type: "PERCENTAGE_DISCOUNT",
      discountType: "PERCENTAGE",
      discountValue: 15,
      priority: 1,
    });

    expect(campaign.id).toBeTruthy();
    expect(campaign.tenant_id).toBe(tenantId);
    expect(campaign.status).toBe("DRAFT");
    expect(campaign.name).toBe("Summer Discount");
    expect(campaign.type).toBe("PERCENTAGE_DISCOUNT");
    expect(campaign.discount_value).toBe(15);
    expect(campaign.usage_count).toBe(0);
    expect(campaign.version).toBe(1);
  });

  it("should create a birthday campaign with configurable window", () => {
    const campaign = service.createCampaign(tenantId, {
      name: "Birthday Special",
      type: "BIRTHDAY",
      discountType: "FIXED_AMOUNT",
      discountValue: 50,
      birthdayWindowDaysBefore: 3,
      birthdayWindowDaysAfter: 7,
    });

    expect(campaign.birthday_window_days_before).toBe(3);
    expect(campaign.birthday_window_days_after).toBe(7);
  });

  // ---------------------------------------------------------------------------
  // Campaign State Machine Transitions
  // ---------------------------------------------------------------------------

  it("should transition DRAFT → SCHEDULED with valid start date", () => {
    const campaign = service.createCampaign(tenantId, {
      name: "Scheduled Campaign",
      type: "FIRST_ORDER",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const scheduled = service.scheduleCampaign(tenantId, campaign.id);
    expect(scheduled.status).toBe("SCHEDULED");
  });

  it("should reject DRAFT → SCHEDULED without start date", () => {
    const campaign = service.createCampaign(tenantId, {
      name: "No Date Campaign",
      type: "FIRST_ORDER",
    });

    expect(() => service.scheduleCampaign(tenantId, campaign.id)).toThrow("CAMPAIGN_MISSING_START_DATE");
  });

  it("should transition DRAFT → ACTIVE directly", () => {
    const campaign = service.createCampaign(tenantId, {
      name: "Immediate Campaign",
      type: "FREE_DELIVERY",
    });

    const active = service.activateCampaign(tenantId, campaign.id);
    expect(active.status).toBe("ACTIVE");
  });

  it("should transition ACTIVE → PAUSED → ACTIVE", () => {
    const campaign = service.createCampaign(tenantId, { name: "Pausable", type: "VIP" });
    service.activateCampaign(tenantId, campaign.id);

    const paused = service.pauseCampaign(tenantId, campaign.id);
    expect(paused.status).toBe("PAUSED");

    const reactivated = service.activateCampaign(tenantId, campaign.id);
    expect(reactivated.status).toBe("ACTIVE");
  });

  it("should transition ACTIVE → COMPLETED", () => {
    const campaign = service.createCampaign(tenantId, { name: "Completable", type: "RETURNING_CUSTOMER" });
    service.activateCampaign(tenantId, campaign.id);

    const completed = service.completeCampaign(tenantId, campaign.id);
    expect(completed.status).toBe("COMPLETED");
  });

  it("should transition any non-terminal → CANCELLED", () => {
    const c1 = service.createCampaign(tenantId, { name: "Draft Cancel", type: "BOGO" });
    expect(service.cancelCampaign(tenantId, c1.id).status).toBe("CANCELLED");

    const c2 = service.createCampaign(tenantId, { name: "Active Cancel", type: "BOGO" });
    service.activateCampaign(tenantId, c2.id);
    expect(service.cancelCampaign(tenantId, c2.id).status).toBe("CANCELLED");
  });

  it("should reject invalid state transitions", () => {
    const campaign = service.createCampaign(tenantId, { name: "Invalid", type: "FREE_ITEM" });
    service.activateCampaign(tenantId, campaign.id);
    service.completeCampaign(tenantId, campaign.id);

    // COMPLETED → ACTIVE is invalid
    expect(() => service.activateCampaign(tenantId, campaign.id)).toThrow("INVALID_CAMPAIGN_TRANSITION");
  });

  it("should validate all campaign transition rules via canTransitionCampaign", () => {
    // Valid transitions
    expect(canTransitionCampaign("DRAFT", "SCHEDULED")).toBe(true);
    expect(canTransitionCampaign("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionCampaign("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransitionCampaign("SCHEDULED", "ACTIVE")).toBe(true);
    expect(canTransitionCampaign("ACTIVE", "PAUSED")).toBe(true);
    expect(canTransitionCampaign("ACTIVE", "COMPLETED")).toBe(true);
    expect(canTransitionCampaign("PAUSED", "ACTIVE")).toBe(true);

    // Invalid transitions
    expect(canTransitionCampaign("COMPLETED", "ACTIVE")).toBe(false);
    expect(canTransitionCampaign("CANCELLED", "ACTIVE")).toBe(false);
    expect(canTransitionCampaign("COMPLETED", "DRAFT")).toBe(false);
    expect(canTransitionCampaign("DRAFT", "COMPLETED")).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Campaign CRUD & Tenant Isolation
  // ---------------------------------------------------------------------------

  it("should only allow editing DRAFT or PAUSED campaigns", () => {
    const campaign = service.createCampaign(tenantId, { name: "Editable", type: "VIP" });
    service.activateCampaign(tenantId, campaign.id);

    expect(() => service.updateCampaign(tenantId, campaign.id, { name: "New Name" })).toThrow("CAMPAIGN_NOT_EDITABLE");
  });

  it("should enforce tenant isolation on getCampaign", () => {
    const campaign = service.createCampaign(tenantId, { name: "Tenant A", type: "VIP" });
    expect(service.getCampaign("org_other_tenant", campaign.id)).toBeNull();
  });

  it("should prevent deleting active campaigns", () => {
    const campaign = service.createCampaign(tenantId, { name: "Active", type: "BOGO" });
    service.activateCampaign(tenantId, campaign.id);

    expect(() => service.deleteCampaign(tenantId, campaign.id)).toThrow("CANNOT_DELETE_ACTIVE_CAMPAIGN");
  });

  // ---------------------------------------------------------------------------
  // Campaign Dispatch
  // ---------------------------------------------------------------------------

  it("should dispatch campaign to eligible customers via mock dispatcher", async () => {
    const dispatcher = new MockCampaignDispatcher();
    const svc = new CampaignService(dispatcher);

    const campaign = svc.createCampaign(tenantId, { name: "Dispatch Test", type: "VIP" });
    svc.activateCampaign(tenantId, campaign.id);

    const customers = [
      { id: "cust_1", phone: "+972501234567", email: "a@test.com" },
      { id: "cust_2", phone: "+972509876543" },
    ];

    const dispatches = await svc.dispatchCampaign(tenantId, campaign.id, customers, "You are VIP!", ["SMS", "EMAIL"]);

    // 2 customers × 2 channels = 4 dispatches
    expect(dispatches).toHaveLength(4);
    expect(dispatches.filter((d) => d.status === "SENT")).toHaveLength(3); // cust_2 has no email
    expect(dispatcher.sentMessages).toHaveLength(3);
  });

  it("should reject dispatching to non-active campaigns", async () => {
    const campaign = service.createCampaign(tenantId, { name: "Draft", type: "VIP" });

    await expect(service.dispatchCampaign(tenantId, campaign.id, [], "msg")).rejects.toThrow("CAMPAIGN_NOT_ACTIVE");
  });
});
