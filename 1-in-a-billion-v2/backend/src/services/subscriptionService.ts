/**
 * SUBSCRIPTION SERVICE
 *
 * Monthly reading quota system:
 *   - basic:       1 reading  / month
 *   - yearly:      3 readings / month
 *   - billionaire: 108 readings / month
 *
 * Quota accounting:
 *   - Individual reading = 1 quota unit  (1 job)
 *   - Synastry reading   = 3 quota units (person1 + person2 + overlay docs)
 *
 * We count from the `jobs` table directly (not a mutable counter) to stay
 * consistent even after retries, rollbacks, or admin fixes.
 */

import { createSupabaseServiceClient } from './supabaseClient';
import type { SubscriptionTier } from './revenuecatService';

// ─── Quota Limits ────────────────────────────────────────────────────────────
export const TIER_MONTHLY_QUOTA: Record<SubscriptionTier, number> = {
  basic: 1,
  yearly: 3,
  billionaire: 108,
};

// Synastry produces 3 documents (person1, person2, overlay). It counts as 3.
const SYNASTRY_WEIGHT = 3;
const INDIVIDUAL_WEIGHT = 1;

// ─── Types ───────────────────────────────────────────────────────────────────
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
  periodStart: string;   // ISO date
  periodEnd: string;     // ISO date
  canStartReading: boolean;
  canStartSynastry: boolean;
}

// ─── Core ────────────────────────────────────────────────────────────────────

export async function checkUserSubscription(userId: string): Promise<UserSubscription | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // no rows
      console.error('Error checking subscription:', error);
      return null;
    }

    return data as UserSubscription;
  } catch (err) {
    console.error('Subscription check failed:', err);
    return null;
  }
}

export async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier | null> {
  const sub = await checkUserSubscription(userId);
  return sub?.subscription_tier ?? null;
}

export async function hasUnlimitedReadings(userId: string): Promise<boolean> {
  // Kept for backward compat — now billionaire just has a very high quota (108/mo)
  // but we still treat them as "unlimited" in the sense that no per-reading IAP is required.
  const sub = await checkUserSubscription(userId);
  if (!sub) return false;
  return sub.subscription_tier === 'billionaire';
}

// ─── Monthly Quota ───────────────────────────────────────────────────────────

/**
 * Get the current billing period boundaries.
 * Uses subscription's current_period_start/end if available;
 * otherwise defaults to calendar month.
 */
function getBillingPeriod(sub: UserSubscription): { start: string; end: string } {
  if (sub.current_period_start && sub.current_period_end) {
    return { start: sub.current_period_start, end: sub.current_period_end };
  }
  // Fallback: current calendar month
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Count how many "reading units" the user has consumed this billing period.
 * Individual reading = 1 unit, synastry = 3 units.
 */
export async function getMonthlyReadingsUsed(userId: string, periodStart: string): Promise<number> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return 0;

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, type')
      .eq('user_id', userId)
      .gte('created_at', periodStart)
      .in('status', ['pending', 'processing', 'complete', 'completed']);

    if (error) {
      console.error('Error counting monthly readings:', error);
      return 0;
    }

    let total = 0;
    for (const job of data || []) {
      const jobType = String(job.type || '').toLowerCase();
      if (jobType === 'synastry') {
        total += SYNASTRY_WEIGHT;
      } else {
        total += INDIVIDUAL_WEIGHT;
      }
    }
    return total;
  } catch (err) {
    console.error('Failed to count monthly readings:', err);
    return 0;
  }
}

/**
 * Full quota status for the current billing period.
 */
export async function getMonthlyQuotaStatus(userId: string): Promise<MonthlyQuotaStatus | null> {
  const sub = await checkUserSubscription(userId);
  if (!sub) return null;

  const tier = sub.subscription_tier;
  const limit = TIER_MONTHLY_QUOTA[tier] ?? 1;
  const period = getBillingPeriod(sub);
  const used = await getMonthlyReadingsUsed(userId, period.start);
  const remaining = Math.max(0, limit - used);

  return {
    tier,
    monthlyLimit: limit,
    used,
    remaining,
    periodStart: period.start,
    periodEnd: period.end,
    canStartReading: remaining >= INDIVIDUAL_WEIGHT,
    canStartSynastry: remaining >= SYNASTRY_WEIGHT,
  };
}

/**
 * Check if user can start a new reading.
 * For synastry, pass isSynastry=true (requires 3 units of quota).
 */
export async function canStartReading(userId: string, isSynastry = false): Promise<boolean> {
  const quota = await getMonthlyQuotaStatus(userId);
  if (!quota) return false;
  return isSynastry ? quota.canStartSynastry : quota.canStartReading;
}

// ─── Legacy compat (still used in jobs route) ────────────────────────────────

export async function canUseIncludedReading(userId: string): Promise<boolean> {
  // Redirect to the new monthly quota system
  return canStartReading(userId, false);
}

export async function markIncludedReadingUsed(
  userId: string,
  system: string,
  jobId: string,
): Promise<boolean> {
  // With the monthly quota system, we no longer need to mark a boolean.
  // Quota is computed by counting jobs. Just log it.
  console.log(`📊 Reading counted toward monthly quota: user=${userId} system=${system} job=${jobId}`);
  return true;
}
