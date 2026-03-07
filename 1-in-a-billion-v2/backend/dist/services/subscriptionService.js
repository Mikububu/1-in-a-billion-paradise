"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_MONTHLY_QUOTA = void 0;
exports.checkUserSubscription = checkUserSubscription;
exports.getUserSubscriptionTier = getUserSubscriptionTier;
exports.hasUnlimitedReadings = hasUnlimitedReadings;
exports.getMonthlyReadingsUsed = getMonthlyReadingsUsed;
exports.getMonthlyQuotaStatus = getMonthlyQuotaStatus;
exports.canStartReading = canStartReading;
exports.canUseIncludedReading = canUseIncludedReading;
const supabaseClient_1 = require("./supabaseClient");
// ─── Quota Limits ────────────────────────────────────────────────────────────
exports.TIER_MONTHLY_QUOTA = {
    basic: 1,
    yearly: 3,
    billionaire: 36,
};
// Synastry produces 3 documents (person1, person2, overlay). It counts as 3.
const SYNASTRY_WEIGHT = 3;
const INDIVIDUAL_WEIGHT = 1;
// ─── Core ────────────────────────────────────────────────────────────────────
async function checkUserSubscription(userId) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('Supabase not configured');
        return null;
    }
    try {
        // Primary lookup: by Supabase user_id
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('subscription_tier', { ascending: false })
            .limit(1);
        if (error) {
            console.error('Error checking subscription:', error);
            return null;
        }
        const sub = data?.[0] ?? null;
        if (!sub)
            return null;
        // Expiration guard: auto-expire stale subscriptions
        if (sub.current_period_end) {
            const expiresAt = new Date(sub.current_period_end).getTime();
            if (expiresAt < Date.now()) {
                console.warn(`⚠️ Subscription ${sub.id} expired at ${sub.current_period_end}, marking expired`);
                supabase
                    .from('user_subscriptions')
                    .update({ status: 'expired', updated_at: new Date().toISOString() })
                    .eq('id', sub.id)
                    .then(({ error: updateErr }) => {
                    if (updateErr)
                        console.error('Failed to expire stale subscription:', updateErr);
                });
                return null;
            }
        }
        return sub;
    }
    catch (err) {
        console.error('Subscription check failed:', err);
        return null;
    }
}
async function getUserSubscriptionTier(userId) {
    const sub = await checkUserSubscription(userId);
    return sub?.subscription_tier ?? null;
}
async function hasUnlimitedReadings(userId) {
    // Billionaire tier has a 36/mo quota but is "unlimited" in the sense that
    // no per-reading IAP purchase is required (the payment gate is skipped).
    const sub = await checkUserSubscription(userId);
    if (!sub)
        return false;
    return sub.subscription_tier === 'billionaire';
}
// ─── Monthly Quota ───────────────────────────────────────────────────────────
/**
 * Get the current monthly quota window.
 *
 * Always uses calendar month boundaries so that quotas are truly "per month"
 * regardless of whether the subscription billing period is monthly or yearly.
 * (Previously used the subscription's billing period, which meant yearly subs
 *  and coupon subs got their "monthly" quota spread across an entire year.)
 */
function getBillingPeriod(_sub) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: start.toISOString(), end: end.toISOString() };
}
/**
 * Count how many "reading units" the user has consumed this billing period.
 * Individual reading = 1 unit, synastry = 3 units.
 */
async function getMonthlyReadingsUsed(userId, periodStart) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return 0;
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('id, type')
            .eq('user_id', userId)
            .gte('created_at', periodStart)
            .in('status', ['queued', 'processing', 'complete']);
        if (error) {
            console.error('Error counting monthly readings:', error);
            return 0;
        }
        let total = 0;
        for (const job of data || []) {
            const jobType = String(job.type || '').toLowerCase();
            if (jobType === 'synastry') {
                total += SYNASTRY_WEIGHT;
            }
            else {
                total += INDIVIDUAL_WEIGHT;
            }
        }
        return total;
    }
    catch (err) {
        console.error('Failed to count monthly readings:', err);
        return 0;
    }
}
/**
 * Full quota status for the current billing period.
 */
async function getMonthlyQuotaStatus(userId) {
    const sub = await checkUserSubscription(userId);
    if (!sub)
        return null;
    const tier = sub.subscription_tier;
    const limit = exports.TIER_MONTHLY_QUOTA[tier] ?? 1;
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
async function canStartReading(userId, isSynastry = false) {
    const quota = await getMonthlyQuotaStatus(userId);
    if (!quota)
        return false;
    return isSynastry ? quota.canStartSynastry : quota.canStartReading;
}
// ─── Legacy compat (still used in jobs route) ────────────────────────────────
async function canUseIncludedReading(userId) {
    // Redirect to the new monthly quota system
    return canStartReading(userId, false);
}
// markIncludedReadingUsed removed: was a no-op since monthly quota is computed by counting jobs.
//# sourceMappingURL=subscriptionService.js.map