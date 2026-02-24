/**
 * SUBSCRIPTION SERVICE
 * 
 * Handles subscription entitlement checks for the yearly plan (price from RevenueCat).
 * Each subscription includes ONE free personal reading (15-20 min audio).
 */

import { createSupabaseServiceClient } from './supabaseClient';

export interface UserSubscription {
  id: string;
  user_id: string | null;
  email: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  status: string;
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
 * Check if user has an active subscription
 * Returns subscription data or null if no active subscription found
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
 * Mark the included reading as used
 * Called after successfully creating the job
 */
export async function markIncludedReadingUsed(
  userId: string,
  system: string,
  jobId: string
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
 * Check if user can use their included reading
 * Returns true if user has active subscription and hasn't used their reading yet
 */
export async function canUseIncludedReading(userId: string): Promise<boolean> {
  const subscription = await checkUserSubscription(userId);
  
  if (!subscription) {
    return false;
  }

  return !subscription.included_reading_used;
}
