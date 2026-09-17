import type {
  Campaign,
  CampaignStatus,
  CampaignDispatch,
  CustomerSegment,
  ICampaignDispatcher,
} from "../domain/marketing";
import { canTransitionCampaign, createCampaignSchema, updateCampaignSchema } from "../domain/marketing";

// ============================================================================
// Phase 6: Campaign Service
// ============================================================================

/**
 * Mock campaign dispatcher for development and testing.
 * Replaced with real Twilio/SendGrid adapters in Phase 8 (Integration Hub).
 */
export class MockCampaignDispatcher implements ICampaignDispatcher {
  public sentMessages: { type: string; to: string; content: string }[] = [];

  async sendSMS(phoneNumber: string, message: string) {
    this.sentMessages.push({ type: "SMS", to: phoneNumber, content: message });
    return { success: true, messageId: `mock_sms_${Date.now()}` };
  }

  async sendWhatsApp(phoneNumber: string, message: string) {
    this.sentMessages.push({ type: "WHATSAPP", to: phoneNumber, content: message });
    return { success: true, messageId: `mock_wa_${Date.now()}` };
  }

  async sendEmail(email: string, subject: string, htmlBody: string) {
    this.sentMessages.push({ type: "EMAIL", to: email, content: `${subject}: ${htmlBody}` });
    return { success: true, messageId: `mock_email_${Date.now()}` };
  }
}

export interface CampaignFilters {
  status?: CampaignStatus;
  type?: Campaign["type"];
  branchId?: string;
  page?: number;
  limit?: number;
}

export class CampaignService {
  private campaigns: Map<string, Campaign> = new Map();
  private dispatches: CampaignDispatch[] = [];
  private dispatcher: ICampaignDispatcher;

  constructor(dispatcher?: ICampaignDispatcher) {
    this.dispatcher = dispatcher ?? new MockCampaignDispatcher();
  }

  /**
   * Create a new campaign in DRAFT status.
   */
  createCampaign(tenantId: string, input: Record<string, any>, createdBy?: string): Campaign {
    const parsed = createCampaignSchema.parse(input);

    const campaign: Campaign = {
      id: `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      branch_id: parsed.branchId ?? null,
      name: parsed.name,
      description: parsed.description ?? null,
      type: parsed.type,
      status: "DRAFT",
      discount_type: parsed.discountType ?? null,
      discount_value: parsed.discountValue ?? null,
      max_discount_amount: parsed.maxDiscountAmount ?? null,
      min_order_amount: parsed.minOrderAmount ?? null,
      starts_at: parsed.startsAt ?? null,
      ends_at: parsed.endsAt ?? null,
      usage_limit: parsed.usageLimit ?? null,
      budget_limit: parsed.budgetLimit ?? null,
      usage_count: 0,
      priority: parsed.priority,
      stack_mode: parsed.stackMode,
      target_segment_id: parsed.targetSegmentId ?? null,
      channel_restriction: parsed.channelRestriction ?? null,
      zone_restriction: parsed.zoneRestriction ?? null,
      product_restriction: parsed.productRestriction ?? null,
      category_restriction: parsed.categoryRestriction ?? null,
      birthday_window_days_before: parsed.birthdayWindowDaysBefore,
      birthday_window_days_after: parsed.birthdayWindowDaysAfter,
      metadata: parsed.metadata ?? {},
      created_by: createdBy ?? null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      version: 1,
    };

    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  /**
   * Update a campaign. Only DRAFT or PAUSED campaigns can be edited.
   */
  updateCampaign(tenantId: string, campaignId: string, input: Record<string, any>): Campaign {
    const campaign = this.getCampaign(tenantId, campaignId);
    if (!campaign) {
      throw new Error("CAMPAIGN_NOT_FOUND");
    }

    if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
      throw new Error("CAMPAIGN_NOT_EDITABLE");
    }

    const parsed = updateCampaignSchema.parse(input);

    const updated: Campaign = {
      ...campaign,
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.discountType !== undefined && { discount_type: parsed.discountType }),
      ...(parsed.discountValue !== undefined && { discount_value: parsed.discountValue }),
      ...(parsed.maxDiscountAmount !== undefined && { max_discount_amount: parsed.maxDiscountAmount }),
      ...(parsed.minOrderAmount !== undefined && { min_order_amount: parsed.minOrderAmount }),
      ...(parsed.startsAt !== undefined && { starts_at: parsed.startsAt }),
      ...(parsed.endsAt !== undefined && { ends_at: parsed.endsAt }),
      ...(parsed.usageLimit !== undefined && { usage_limit: parsed.usageLimit }),
      ...(parsed.priority !== undefined && { priority: parsed.priority }),
      ...(parsed.stackMode !== undefined && { stack_mode: parsed.stackMode }),
      ...(parsed.channelRestriction !== undefined && { channel_restriction: parsed.channelRestriction }),
      ...(parsed.birthdayWindowDaysBefore !== undefined && { birthday_window_days_before: parsed.birthdayWindowDaysBefore }),
      ...(parsed.birthdayWindowDaysAfter !== undefined && { birthday_window_days_after: parsed.birthdayWindowDaysAfter }),
      updated_at: new Date(),
      version: campaign.version + 1,
    };

    this.campaigns.set(campaignId, updated);
    return updated;
  }

  /**
   * Transition a campaign through its lifecycle state machine.
   */
  transitionCampaign(tenantId: string, campaignId: string, targetStatus: CampaignStatus): Campaign {
    const campaign = this.getCampaign(tenantId, campaignId);
    if (!campaign) {
      throw new Error("CAMPAIGN_NOT_FOUND");
    }

    if (!canTransitionCampaign(campaign.status, targetStatus)) {
      throw new Error(
        `INVALID_CAMPAIGN_TRANSITION: Cannot transition from ${campaign.status} to ${targetStatus}`
      );
    }

    // Validation for scheduling: require starts_at for SCHEDULED
    let startsAt = campaign.starts_at;
    if (targetStatus === "SCHEDULED" && !startsAt) {
      throw new Error("CAMPAIGN_MISSING_START_DATE: A future start date is required to schedule a campaign");
    }
    if (targetStatus === "ACTIVE" && !startsAt) {
      startsAt = new Date();
    }

    const updated: Campaign = {
      ...campaign,
      starts_at: startsAt,
      status: targetStatus,
      updated_at: new Date(),
      version: campaign.version + 1,
    };

    this.campaigns.set(campaignId, updated);
    return updated;
  }

  /**
   * Convenience methods for specific lifecycle transitions.
   */
  scheduleCampaign(tenantId: string, campaignId: string, startsAt?: string | Date): Campaign {
    if (startsAt) {
      const campaign = this.getCampaign(tenantId, campaignId);
      if (campaign) campaign.starts_at = startsAt;
    }
    return this.transitionCampaign(tenantId, campaignId, "SCHEDULED");
  }

  activateCampaign(tenantId: string, campaignId: string): Campaign {
    return this.transitionCampaign(tenantId, campaignId, "ACTIVE");
  }

  pauseCampaign(tenantId: string, campaignId: string): Campaign {
    return this.transitionCampaign(tenantId, campaignId, "PAUSED");
  }

  completeCampaign(tenantId: string, campaignId: string): Campaign {
    return this.transitionCampaign(tenantId, campaignId, "COMPLETED");
  }

  cancelCampaign(tenantId: string, campaignId: string): Campaign {
    return this.transitionCampaign(tenantId, campaignId, "CANCELLED");
  }

  /**
   * Get a single campaign with tenant guard.
   */
  getCampaign(tenantId: string, campaignId: string): Campaign | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.tenant_id !== tenantId || campaign.deleted_at) {
      return null;
    }
    return campaign;
  }

  /**
   * List campaigns with filtering and pagination.
   */
  listCampaigns(tenantId: string, filters?: CampaignFilters): {
    data: Campaign[];
    total: number;
    page: number;
    limit: number;
  } {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;

    let results = Array.from(this.campaigns.values()).filter(
      (c) => c.tenant_id === tenantId && !c.deleted_at
    );

    if (filters?.status) {
      results = results.filter((c) => c.status === filters.status);
    }
    if (filters?.type) {
      results = results.filter((c) => c.type === filters.type);
    }
    if (filters?.branchId) {
      results = results.filter((c) => c.branch_id === filters.branchId || !c.branch_id);
    }

    const total = results.length;
    const offset = (page - 1) * limit;
    const data = results.slice(offset, offset + limit);

    return { data, total, page, limit };
  }

  /**
   * Soft-delete a campaign.
   */
  deleteCampaign(tenantId: string, campaignId: string): void {
    const campaign = this.getCampaign(tenantId, campaignId);
    if (!campaign) {
      throw new Error("CAMPAIGN_NOT_FOUND");
    }

    if (campaign.status === "ACTIVE") {
      throw new Error("CANNOT_DELETE_ACTIVE_CAMPAIGN");
    }

    this.campaigns.set(campaignId, {
      ...campaign,
      deleted_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * Dispatch campaign to eligible customers via the configured dispatcher.
   * Returns dispatch tracking records.
   */
  async dispatchCampaign(
    tenantId: string,
    campaignId: string,
    eligibleCustomers: { id: string; phone?: string; email?: string }[],
    message: string,
    channels: ("SMS" | "WHATSAPP" | "EMAIL")[] = ["SMS"]
  ): Promise<CampaignDispatch[]> {
    const campaign = this.getCampaign(tenantId, campaignId);
    if (!campaign) {
      throw new Error("CAMPAIGN_NOT_FOUND");
    }

    if (campaign.status !== "ACTIVE") {
      throw new Error("CAMPAIGN_NOT_ACTIVE");
    }

    const results: CampaignDispatch[] = [];

    for (const customer of eligibleCustomers) {
      for (const channel of channels) {
        const dispatch: CampaignDispatch = {
          id: `disp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          tenant_id: tenantId,
          campaign_id: campaignId,
          customer_id: customer.id,
          channel,
          status: "PENDING",
          sent_at: null,
          error: null,
          created_at: new Date(),
        };

        try {
          let result: { success: boolean };
          switch (channel) {
            case "SMS":
              result = customer.phone
                ? await this.dispatcher.sendSMS(customer.phone, message)
                : { success: false };
              break;
            case "WHATSAPP":
              result = customer.phone
                ? await this.dispatcher.sendWhatsApp(customer.phone, message)
                : { success: false };
              break;
            case "EMAIL":
              result = customer.email
                ? await this.dispatcher.sendEmail(customer.email, campaign.name, message)
                : { success: false };
              break;
          }

          dispatch.status = result.success ? "SENT" : "FAILED";
          dispatch.sent_at = result.success ? new Date() : null;
        } catch (err) {
          dispatch.status = "FAILED";
          dispatch.error = err instanceof Error ? err.message : "Unknown error";
        }

        results.push(dispatch);
        this.dispatches.push(dispatch);
      }
    }

    return results;
  }

  /** Test helper: get all dispatches */
  getDispatches(): CampaignDispatch[] {
    return this.dispatches;
  }

  /** Test helper: inject campaign directly */
  _injectCampaign(campaign: Campaign): void {
    this.campaigns.set(campaign.id, campaign);
  }
}
