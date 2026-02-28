-- Migration 007: Add subscription_tier column to user_subscriptions
-- Tiers: 'basic' (monthly), 'yearly', 'billionaire'
-- Billionaire tier gets unlimited readings (no IAP required)

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'yearly';

-- Add a comment for clarity
COMMENT ON COLUMN user_subscriptions.subscription_tier IS 'basic | yearly | billionaire — controls reading access';
