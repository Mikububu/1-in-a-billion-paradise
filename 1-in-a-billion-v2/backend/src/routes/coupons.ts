/**
 * COUPON CODE ROUTES
 *
 * GET  /api/coupons/validate?code=XXX  — Check if a code is valid (public, no auth needed before signup)
 * POST /api/coupons/redeem              — Redeem a code and grant subscription (no auth — used pre-signup)
 * POST /api/coupons/admin/create        — Create a new coupon (admin only, requires auth)
 * GET  /api/coupons/admin/list          — List all coupons (admin only)
 */

import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { requireAuth } from '../middleware/requireAuth';
import type { AppEnv } from '../types/hono';

const coupons = new Hono<AppEnv>();

/** Admin guard: requires x-admin-secret header matching ADMIN_PANEL_SECRET */
function requireAdminSecret(c: any): Response | null {
  const secret = c.req.header('x-admin-secret');
  if (!env.ADMIN_PANEL_SECRET || !secret) {
    return c.json({ error: 'Unauthorized — missing admin secret' }, 401);
  }
  const expected = Buffer.from(env.ADMIN_PANEL_SECRET, 'utf8');
  const received = Buffer.from(secret, 'utf8');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return c.json({ error: 'Unauthorized — invalid admin secret' }, 401);
  }
  return null; // authorized
}

function getServiceClient() {
  const { createClient } = require('@supabase/supabase-js');
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// ─────────────────────────────────────────────────────────────
// GET /api/coupons/validate?code=XXX
// Public endpoint — user types a code and we tell them if it's valid.
// ─────────────────────────────────────────────────────────────
coupons.get('/validate', async (c) => {
  const code = (c.req.query('code') || '').trim().toUpperCase();
  if (!code) {
    return c.json({ success: false, valid: false, error: 'No code provided' }, 400);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return c.json({ success: false, valid: false, error: 'Service unavailable' }, 500);
  }

  const { data: coupon, error } = await supabase
    .from('coupon_codes')
    .select('id, code, discount_percent, max_uses, times_used, expires_at, is_active')
    .eq('is_active', true)
    .ilike('code', code)
    .maybeSingle();

  if (error || !coupon) {
    return c.json({ success: true, valid: false, message: 'Invalid coupon code' });
  }

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return c.json({ success: true, valid: false, message: 'This code has expired' });
  }

  // Check usage limit
  if (coupon.max_uses !== null && coupon.times_used >= coupon.max_uses) {
    return c.json({ success: true, valid: false, message: 'This code has been fully redeemed' });
  }

  return c.json({
    success: true,
    valid: true,
    discount_percent: coupon.discount_percent,
    message: coupon.discount_percent === 100
      ? 'Free access!'
      : `${coupon.discount_percent}% off`,
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/coupons/redeem
// Body: { code: string, deviceId?: string }
// No auth required — this happens before the user has an account.
// If 100% discount: creates a subscription row so the user gets full access.
// Returns a coupon_redemption_id that the frontend passes to AccountScreen.
// ─────────────────────────────────────────────────────────────
coupons.post('/redeem', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { code?: string; deviceId?: string };
  const code = (body.code || '').trim().toUpperCase();

  if (!code) {
    return c.json({ success: false, error: 'No code provided' }, 400);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return c.json({ success: false, error: 'Service unavailable' }, 500);
  }

  // Fetch the coupon
  const { data: coupon, error: fetchErr } = await supabase
    .from('coupon_codes')
    .select('*')
    .eq('is_active', true)
    .ilike('code', code)
    .maybeSingle();

  if (fetchErr || !coupon) {
    return c.json({ success: false, error: 'Invalid coupon code' }, 400);
  }

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return c.json({ success: false, error: 'This code has expired' }, 400);
  }

  // Check usage limit
  if (coupon.max_uses !== null && coupon.times_used >= coupon.max_uses) {
    return c.json({ success: false, error: 'This code has been fully redeemed' }, 400);
  }

  // Atomic increment usage counter (prevents race condition where two concurrent
  // redemptions both read the same times_used and both pass the max_uses check)
  const { data: updated, error: updateErr } = await supabase
    .rpc('increment_coupon_usage', { coupon_id: coupon.id, usage_limit: coupon.max_uses });

  // If the RPC doesn't exist yet, fall back to optimistic update with re-check
  if (updateErr?.code === '42883') {
    // Fallback: conditional update that only succeeds if times_used hasn't changed
    const { data: updatedRow, error: fallbackErr } = await supabase
      .from('coupon_codes')
      .update({
        times_used: coupon.times_used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coupon.id)
      .eq('times_used', coupon.times_used)  // optimistic lock
      .select('times_used')
      .maybeSingle();

    if (fallbackErr || !updatedRow) {
      return c.json({ success: false, error: 'Coupon was just redeemed by someone else. Please try again.' }, 409);
    }
  } else if (updateErr) {
    console.error('Failed to increment coupon usage:', updateErr);
  } else if (updated === false) {
    // RPC returned false = limit exceeded
    return c.json({ success: false, error: 'This code has been fully redeemed' }, 400);
  }

  // Create redemption record
  const { data: redemption, error: redeemErr } = await supabase
    .from('coupon_redemptions')
    .insert({
      coupon_id: coupon.id,
      device_id: body.deviceId || null,
    })
    .select('id')
    .single();

  if (redeemErr) {
    console.error('Failed to create redemption record:', redeemErr);
    return c.json({ success: false, error: 'Failed to redeem coupon' }, 500);
  }

  // If 100% off, create a subscription entry so entitlement checks pass
  let subscriptionCreated = false;
  if (coupon.discount_percent === 100) {
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);

    const { error: subErr } = await supabase
      .from('user_subscriptions')
      .insert({
        stripe_customer_id: `coupon_${coupon.code}`,
        stripe_subscription_id: `coupon_${redemption.id}`,
        stripe_price_id: 'coupon_free',
        subscription_tier: 'yearly',  // Coupon users get yearly-tier quota (3 readings/month)
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: oneYear.toISOString(),
        metadata: {
          source: 'coupon',
          coupon_code: coupon.code,
          redemption_id: redemption.id,
          discount_percent: 100,
        },
      })
      .select('id')
      .single();

    if (subErr) {
      console.error('Failed to create coupon subscription:', subErr);
      return c.json({ success: false, error: 'Coupon valid but failed to activate subscription' }, 500);
    }
    subscriptionCreated = true;
  }

  console.log(`🎟️ Coupon ${coupon.code} redeemed (redemption: ${redemption.id})`);

  return c.json({
    success: true,
    redemption_id: redemption.id,
    discount_percent: coupon.discount_percent,
    subscription_active: subscriptionCreated,
    coupon_customer_id: `coupon_${coupon.code}`,
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/coupons/link-user
// After the user creates their account, link the coupon subscription to their user_id.
// Body: { redemptionId: string, couponCustomerId: string }
// Requires auth (user just signed up).
// ─────────────────────────────────────────────────────────────
coupons.post('/link-user', requireAuth, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({})) as {
    redemptionId?: string;
    couponCustomerId?: string;
  };

  if (!body.couponCustomerId) {
    return c.json({ success: false, error: 'Missing couponCustomerId' }, 400);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return c.json({ success: false, error: 'Service unavailable' }, 500);
  }

  // Link the subscription row to this user
  const { error: subErr } = await supabase
    .from('user_subscriptions')
    .update({
      user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', body.couponCustomerId);

  if (subErr) {
    console.error('Failed to link coupon subscription to user:', subErr);
  }

  // Link the redemption record to this user
  if (body.redemptionId) {
    const { error: redemptionErr } = await supabase
      .from('coupon_redemptions')
      .update({ user_id: userId })
      .eq('id', body.redemptionId);

    if (redemptionErr) {
      console.error('Failed to link redemption to user:', redemptionErr);
    }
  }

  return c.json({ success: true, linked: true });
});

// ─────────────────────────────────────────────────────────────
// ADMIN ROUTES — require auth + admin check
// ─────────────────────────────────────────────────────────────

// POST /api/coupons/admin/create
coupons.post('/admin/create', requireAuth, async (c) => {
  const adminErr = requireAdminSecret(c);
  if (adminErr) return adminErr;

  const body = await c.req.json().catch(() => ({})) as {
    code?: string;
    discount_percent?: number;
    max_uses?: number | null;
    expires_at?: string | null;
    note?: string;
  };

  const code = (body.code || '').trim().toUpperCase();
  if (!code || code.length < 3) {
    return c.json({ success: false, error: 'Code must be at least 3 characters' }, 400);
  }

  const discount = body.discount_percent ?? 100;
  if (discount < 0 || discount > 100) {
    return c.json({ success: false, error: 'Discount must be 0-100' }, 400);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return c.json({ success: false, error: 'Service unavailable' }, 500);
  }

  const { data, error } = await supabase
    .from('coupon_codes')
    .insert({
      code,
      discount_percent: discount,
      max_uses: body.max_uses ?? null,
      expires_at: body.expires_at ?? null,
      note: body.note ?? null,
      created_by: c.get('userId'),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return c.json({ success: false, error: 'A coupon with this code already exists' }, 409);
    }
    console.error('Failed to create coupon:', error);
    return c.json({ success: false, error: 'Failed to create coupon' }, 500);
  }

  console.log(`🎟️ New coupon created: ${code} (${discount}% off)`);
  return c.json({ success: true, coupon: data });
});

// GET /api/coupons/admin/list
coupons.get('/admin/list', requireAuth, async (c) => {
  const adminErr = requireAdminSecret(c);
  if (adminErr) return adminErr;

  const supabase = getServiceClient();
  if (!supabase) {
    return c.json({ success: false, error: 'Service unavailable' }, 500);
  }

  const { data, error } = await supabase
    .from('coupon_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ success: false, error: 'Failed to fetch coupons' }, 500);
  }

  return c.json({ success: true, coupons: data });
});

export default coupons;
