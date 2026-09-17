import type {
  LoyaltyProgram,
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyTier,
  LoyaltyTransactionType,
} from "../domain/marketing";
import {
  calculateLoyaltyTier,
  createLoyaltyProgramSchema,
  updateLoyaltyProgramSchema,
  redeemPointsSchema,
  LOYALTY_TIER_LABELS,
} from "../domain/marketing";

// ============================================================================
// Phase 6: Loyalty Service — Points Engine & Tier Management
// ============================================================================

export class LoyaltyService {
  private programs: Map<string, LoyaltyProgram> = new Map();
  private accounts: Map<string, LoyaltyAccount> = new Map();
  private transactions: LoyaltyTransaction[] = [];

  /**
   * Create or update the loyalty program configuration for a tenant.
   * Each tenant has exactly one loyalty program.
   */
  createProgram(tenantId: string, input: Record<string, any>): LoyaltyProgram {
    const parsed = createLoyaltyProgramSchema.parse(input);

    // Check for existing program
    const existing = this.getProgram(tenantId);
    if (existing) {
      throw new Error("LOYALTY_PROGRAM_ALREADY_EXISTS");
    }

    const program: LoyaltyProgram = {
      id: `loy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      name: parsed.name,
      points_display_name: parsed.pointsDisplayName,
      points_per_currency_unit: parsed.pointsPerCurrencyUnit,
      currency_per_point: parsed.currencyPerPoint,
      regular_threshold: parsed.regularThreshold,
      vip_threshold: parsed.vipThreshold,
      points_expiry_days: parsed.pointsExpiryDays ?? null,
      birthday_window_days_before: parsed.birthdayWindowDaysBefore,
      birthday_window_days_after: parsed.birthdayWindowDaysAfter,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      version: 1,
    };

    this.programs.set(tenantId, program);
    return program;
  }

  /**
   * Update the loyalty program configuration.
   */
  updateProgram(tenantId: string, input: Record<string, any>): LoyaltyProgram {
    const program = this.getProgram(tenantId);
    if (!program) {
      throw new Error("LOYALTY_PROGRAM_NOT_FOUND");
    }

    const parsed = updateLoyaltyProgramSchema.parse(input);

    const updated: LoyaltyProgram = {
      ...program,
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.pointsDisplayName !== undefined && { points_display_name: parsed.pointsDisplayName }),
      ...(parsed.pointsPerCurrencyUnit !== undefined && { points_per_currency_unit: parsed.pointsPerCurrencyUnit }),
      ...(parsed.currencyPerPoint !== undefined && { currency_per_point: parsed.currencyPerPoint }),
      ...(parsed.regularThreshold !== undefined && { regular_threshold: parsed.regularThreshold }),
      ...(parsed.vipThreshold !== undefined && { vip_threshold: parsed.vipThreshold }),
      ...(parsed.pointsExpiryDays !== undefined && { points_expiry_days: parsed.pointsExpiryDays }),
      ...(parsed.birthdayWindowDaysBefore !== undefined && { birthday_window_days_before: parsed.birthdayWindowDaysBefore }),
      ...(parsed.birthdayWindowDaysAfter !== undefined && { birthday_window_days_after: parsed.birthdayWindowDaysAfter }),
      updated_at: new Date(),
      version: program.version + 1,
    };

    this.programs.set(tenantId, updated);
    return updated;
  }

  /**
   * Get the loyalty program for a tenant.
   */
  getProgram(tenantId: string): LoyaltyProgram | null {
    return this.programs.get(tenantId) ?? null;
  }

  /**
   * Get or create a loyalty account for a customer.
   */
  getOrCreateAccount(tenantId: string, customerId: string): LoyaltyAccount {
    const key = `${tenantId}:${customerId}`;
    let account = this.accounts.get(key);

    if (!account) {
      account = {
        id: `la_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        tenant_id: tenantId,
        customer_id: customerId,
        current_points: 0,
        lifetime_points: 0,
        current_tier: "NEW_CUSTOMER",
        tier_updated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
      };
      this.accounts.set(key, account);
    }

    return account;
  }

  /**
   * Get a loyalty account. Returns null if not found.
   */
  getAccount(tenantId: string, customerId: string): LoyaltyAccount | null {
    return this.accounts.get(`${tenantId}:${customerId}`) ?? null;
  }

  /**
   * Award points to a customer (typically on order completion).
   * Automatically recalculates tier.
   *
   * Returns: { account, transaction, tierChanged, previousTier, newTier }
   */
  earnPoints(
    tenantId: string,
    customerId: string,
    orderAmount: number,
    orderId?: string | null
  ): {
    account: LoyaltyAccount;
    transaction: LoyaltyTransaction;
    tierChanged: boolean;
    previousTier: LoyaltyTier;
    newTier: LoyaltyTier;
  } {
    const program = this.getProgram(tenantId);
    if (!program || !program.is_active) {
      throw new Error("LOYALTY_PROGRAM_NOT_ACTIVE");
    }

    const account = this.getOrCreateAccount(tenantId, customerId);
    const pointsToEarn = Math.floor(orderAmount * program.points_per_currency_unit);

    if (pointsToEarn <= 0) {
      throw new Error("NO_POINTS_TO_EARN");
    }

    const previousTier = account.current_tier;

    // Update account
    account.current_points += pointsToEarn;
    account.lifetime_points += pointsToEarn;
    account.updated_at = new Date();
    account.version += 1;

    // Calculate expiry date
    const expiresAt = program.points_expiry_days
      ? new Date(Date.now() + program.points_expiry_days * 24 * 60 * 60 * 1000)
      : null;

    // Record transaction
    const transaction: LoyaltyTransaction = {
      id: `lt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      account_id: account.id,
      type: "EARN",
      points: pointsToEarn,
      balance_after: account.current_points,
      order_id: orderId ?? null,
      description: `Earned ${pointsToEarn} ${program.points_display_name} for order`,
      expires_at: expiresAt,
      created_at: new Date(),
    };
    this.transactions.push(transaction);

    // Recalculate tier
    const newTier = calculateLoyaltyTier(account.lifetime_points, program);
    const tierChanged = newTier !== previousTier;

    if (tierChanged) {
      account.current_tier = newTier;
      account.tier_updated_at = new Date();
    }

    // Persist updated account
    this.accounts.set(`${tenantId}:${customerId}`, account);

    return { account, transaction, tierChanged, previousTier, newTier };
  }

  /**
   * Redeem points from a customer's account.
   */
  redeemPoints(
    tenantId: string,
    customerId: string,
    input: Record<string, any>
  ): {
    account: LoyaltyAccount;
    transaction: LoyaltyTransaction;
    currencyValue: number;
  } {
    const parsed = redeemPointsSchema.parse(input);
    const program = this.getProgram(tenantId);
    if (!program || !program.is_active) {
      throw new Error("LOYALTY_PROGRAM_NOT_ACTIVE");
    }

    const account = this.getAccount(tenantId, customerId);
    if (!account) {
      throw new Error("LOYALTY_ACCOUNT_NOT_FOUND");
    }

    if (account.current_points < parsed.points) {
      throw new Error("INSUFFICIENT_POINTS");
    }

    // Deduct points
    account.current_points -= parsed.points;
    account.updated_at = new Date();
    account.version += 1;

    const currencyValue = Math.round(parsed.points * program.currency_per_point * 100) / 100;

    // Record transaction
    const transaction: LoyaltyTransaction = {
      id: `lt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      account_id: account.id,
      type: "REDEEM",
      points: -parsed.points,
      balance_after: account.current_points,
      order_id: parsed.orderId ?? null,
      description: parsed.description ?? `Redeemed ${parsed.points} ${program.points_display_name}`,
      expires_at: null,
      created_at: new Date(),
    };
    this.transactions.push(transaction);

    // Persist
    this.accounts.set(`${tenantId}:${customerId}`, account);

    return { account, transaction, currencyValue };
  }

  /**
   * Rollback earned points (e.g., on order cancellation/refund).
   */
  rollbackPoints(
    tenantId: string,
    customerId: string,
    orderId: string
  ): {
    account: LoyaltyAccount;
    transaction: LoyaltyTransaction;
    tierChanged: boolean;
    previousTier: LoyaltyTier;
    newTier: LoyaltyTier;
  } | null {
    const program = this.getProgram(tenantId);
    if (!program) return null;

    const account = this.getAccount(tenantId, customerId);
    if (!account) return null;

    // Find the original earn transaction for this order
    const originalEarn = this.transactions.find(
      (t) =>
        t.tenant_id === tenantId &&
        t.account_id === account.id &&
        t.order_id === orderId &&
        t.type === "EARN"
    );

    if (!originalEarn) return null;

    const pointsToRollback = originalEarn.points;
    const previousTier = account.current_tier;

    // Deduct from both current and lifetime
    account.current_points = Math.max(0, account.current_points - pointsToRollback);
    account.lifetime_points = Math.max(0, account.lifetime_points - pointsToRollback);
    account.updated_at = new Date();
    account.version += 1;

    // Record rollback transaction
    const transaction: LoyaltyTransaction = {
      id: `lt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      account_id: account.id,
      type: "ADJUSTMENT",
      points: -pointsToRollback,
      balance_after: account.current_points,
      order_id: orderId,
      description: `Rollback: ${pointsToRollback} ${program.points_display_name} reversed for cancelled order`,
      expires_at: null,
      created_at: new Date(),
    };
    this.transactions.push(transaction);

    // Recalculate tier (may demote)
    const newTier = calculateLoyaltyTier(account.lifetime_points, program);
    const tierChanged = newTier !== previousTier;

    if (tierChanged) {
      account.current_tier = newTier;
      account.tier_updated_at = new Date();
    }

    // Persist
    this.accounts.set(`${tenantId}:${customerId}`, account);

    return { account, transaction, tierChanged, previousTier, newTier };
  }

  /**
   * Get points transaction history for a customer.
   */
  getPointsHistory(
    tenantId: string,
    customerId: string,
    options?: { page?: number; limit?: number }
  ): { data: LoyaltyTransaction[]; total: number; page: number; limit: number } {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;

    const account = this.getAccount(tenantId, customerId);
    if (!account) {
      return { data: [], total: 0, page, limit };
    }

    const matching = this.transactions
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => t.tenant_id === tenantId && t.account_id === account.id)
      .sort((a, b) => {
        const timeDiff = new Date(b.t.created_at).getTime() - new Date(a.t.created_at).getTime();
        return timeDiff !== 0 ? timeDiff : b.idx - a.idx;
      });

    const allTransactions = matching.map(({ t }) => t);

    const total = allTransactions.length;
    const offset = (page - 1) * limit;
    const data = allTransactions.slice(offset, offset + limit);

    return { data, total, page, limit };
  }

  /**
   * Expire points that have passed their expiration date.
   */
  expirePoints(tenantId: string): number {
    const now = new Date();
    let totalExpired = 0;

    const earnTransactions = this.transactions.filter(
      (t) =>
        t.tenant_id === tenantId &&
        t.type === "EARN" &&
        t.expires_at &&
        new Date(t.expires_at) < now
    );

    // Group by account
    const accountExpiry = new Map<string, number>();
    for (const tx of earnTransactions) {
      const current = accountExpiry.get(tx.account_id) ?? 0;
      accountExpiry.set(tx.account_id, current + tx.points);
    }

    for (const [accountId, pointsToExpire] of accountExpiry) {
      const account = Array.from(this.accounts.values()).find((a) => a.id === accountId);
      if (!account || pointsToExpire <= 0) continue;

      const actualExpiry = Math.min(pointsToExpire, account.current_points);
      if (actualExpiry <= 0) continue;

      account.current_points -= actualExpiry;
      account.updated_at = new Date();
      account.version += 1;

      const program = this.getProgram(tenantId);

      const transaction: LoyaltyTransaction = {
        id: `lt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        tenant_id: tenantId,
        account_id: accountId,
        type: "EXPIRE",
        points: -actualExpiry,
        balance_after: account.current_points,
        order_id: null,
        description: `${actualExpiry} ${program?.points_display_name ?? "points"} expired`,
        expires_at: null,
        created_at: new Date(),
      };
      this.transactions.push(transaction);

      totalExpired += actualExpiry;
    }

    return totalExpired;
  }

  /**
   * Get the tier label in Hebrew for display purposes.
   */
  getTierLabel(tier: LoyaltyTier): string {
    return LOYALTY_TIER_LABELS[tier];
  }

  /** Test helper: inject program directly */
  _injectProgram(program: LoyaltyProgram): void {
    this.programs.set(program.tenant_id, program);
  }

  /** Test helper: inject account directly */
  _injectAccount(account: LoyaltyAccount): void {
    this.accounts.set(`${account.tenant_id}:${account.customer_id}`, account);
  }

  /** Test helper: inject transaction directly */
  _injectTransaction(transaction: LoyaltyTransaction): void {
    this.transactions.push(transaction);
  }
}
