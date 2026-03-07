/**
 * SUBSCRIPTION SERVICE
 *
 * Monthly reading quota system:
 *   - basic:       1 reading  / month
 *   - yearly:      3 readings / month
 *   - billionaire: 36 readings / month
 *
 * Quota accounting:
 *   - Individual reading = 1 quota unit  (1 job)
 *   - Synastry reading   = 3 quota units (person1 + person2 + overlay docs)
 *
 * We count from the `jobs` table directly (not a mutable counter) to stay
 * consistent even after retries, rollbacks, or admin fixes.
 */
import type { SubscriptionTier } from './revenuecatService';
export declare const TIER_MONTHLY_QUOTA: Record<SubscriptionTier, number>;
export interface UserSubscription {
    id: string;
    user_id: string | null;
    email: string | null;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    stripe_price_id: string | null;
    status: string;
    subscription_tier: SubscriptionTier;
    cancel_at_period_end: boolean;
    current_period_start: string | null;
    current_period_end: string | null;
    included_reading_used: boolean;
    included_reading_system: string | null;
    included_reading_job_id: string | null;
    metadata: any;
    created_at: string;
    updated_at: string;
}
export interface MonthlyQuotaStatus {
    tier: SubscriptionTier;
    monthlyLimit: number;
    used: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
    canStartReading: boolean;
    canStartSynastry: boolean;
}
export declare function checkUserSubscription(userId: string): Promise<UserSubscription | null>;
export declare function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier | null>;
export declare function hasUnlimitedReadings(userId: string): Promise<boolean>;
/**
 * Count how many "reading units" the user has consumed this billing period.
 * Individual reading = 1 unit, synastry = 3 units.
 */
export declare function getMonthlyReadingsUsed(userId: string, periodStart: string): Promise<number>;
/**
 * Full quota status for the current billing period.
 */
export declare function getMonthlyQuotaStatus(userId: string): Promise<MonthlyQuotaStatus | null>;
/**
 * Check if user can start a new reading.
 * For synastry, pass isSynastry=true (requires 3 units of quota).
 */
export declare function canStartReading(userId: string, isSynastry?: boolean): Promise<boolean>;
export declare function canUseIncludedReading(userId: string): Promise<boolean>;
//# sourceMappingURL=subscriptionService.d.ts.map