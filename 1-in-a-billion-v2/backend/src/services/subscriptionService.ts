/**
 * SUBSCRIPTION SERVICE
 *
 * Handles subscription entitlement checks.
 * Tier-aware: billionaire tier gets unlimited readings (no IAP required).
 * Basic/yearly tiers include ONE free personal reading.
 */

import { createSupabaseServiceClient } from './supabaseClient';
import type { SubscriptionTier } from './revenuecatService';

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

/**
 * Check if user has an active subscription.
 * Returns subscription data or null if no active subscription found.
 */
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
      if (error.code === 'PGRST116') {
        // No rows returned - user has no active subscription
        return null;
      }
      console.error('Error checking subscription:', error);
      return null;
    }

    return data as UserSubscription;
  } catch (err) {
    console.error('Subscription check failed:', err);
    return null;
  }
}

/**
 * Get the user's subscription tier (or null if no active subscription).
 */
export async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier | null> {
  const sub = await checkUserSubscription(userId);
  return sub?.subscription_tier ?? null;
}

/**
 * Check if user has unlimited readings (billionaire tier).
 * Returns true if the user should NOT be charged for individual readings.
 */
export async function hasUnlimitedReadings(userId: string): Promise<boolean> {
  const sub = await checkUserSubscription(userId);
  if (!sub) return false;
  return sub.subscription_tier === 'billionaire';
}

/**
 * Mark the included reading as used.
 * Called after successfully creating the job (only for basic/yearly tiers).
 */
export async function markIncludedReadingUsed(
  userId: string,
  system: string,
  jobId: string,
): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('Supabase not configured');
    return false;
  }

  try {
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        included_reading_used: true,
        included_reading_system: system,
        included_reading_job_id: jobId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('Error marking included reading as used:', error);
      return false;
    }

    console.log(`✅ Marked included reading as used for user ${userId} (${system})`);
    return true;
  } catch (err) {
    console.error('Failed to mark included reading as used:', err);
    return false;
  }
}

/**
 * Check if user can use their included reading.
 * Billionaire tier always returns true (unlimited).
 * Basic/yearly returns true only if they haven't used their 1 free reading.
 */
export async function canUseIncludedReading(userId: string): Promise<boolean> {
  const subscription = await checkUserSubscription(userId);
  if (!subscription) return false;

  // Billionaire = unlimited readings, always eligible
  if (subscription.subscription_tier === 'billionaire') return true;

  return !subscription.included_reading_used;
}
