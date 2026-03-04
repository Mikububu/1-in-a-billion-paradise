/**
 * COST TRACKING SERVICE
 * 
 * Tracks and calculates costs for all API calls:
 * - LLM providers (Claude, DeepSeek, OpenAI)
 * - Replicate API (TTS audio generation)
 * - MiniMax song generation
 * 
 * Pricing as of Jan 2026 (per 1M tokens unless noted):
 */

import { createSupabaseServiceClient } from './supabaseClient';

// ═══════════════════════════════════════════════════════════════════════════
// PRICING CACHE (dynamically fetched from pricing_tiers table)
// ═══════════════════════════════════════════════════════════════════════════
let pricingCache: Record<string, any> = {};
let pricingCacheTimestamp = 0;
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export async function getPricingTiers(): Promise<Record<string, any>> {
  const now = Date.now();
  if (now - pricingCacheTimestamp < CACHE_TTL_MS && Object.keys(pricingCache).length > 0) {
    return pricingCache;
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) return pricingCache;

  try {
    const { data, error } = await supabase.from('pricing_tiers').select('*');
    if (error) throw error;

    const newCache: Record<string, any> = {};
    for (const row of data || []) {
      newCache[row.provider] = row;
    }

    pricingCache = newCache;
    pricingCacheTimestamp = now;
    return pricingCache;
  } catch (err: any) {
    console.error('❌ [Cost] Failed to fetch pricing tiers:', err.message);
    return pricingCache;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRICING CONFIGURATION (per 1M tokens)
// ═══════════════════════════════════════════════════════════════════════════

export const LLM_PRICING = {
  deepseek: {
    name: 'DeepSeek',
    inputPer1M: 0.14,   // $0.14 per 1M input tokens
    outputPer1M: 0.28,  // $0.28 per 1M output tokens
    model: 'deepseek-chat',
  },
  claude: {
    name: 'Claude Sonnet 4',
    inputPer1M: 3.00,   // $3.00 per 1M input tokens
    outputPer1M: 15.00, // $15.00 per 1M output tokens
    model: 'claude-sonnet-4-20250514',
  },
  openai: {
    name: 'OpenAI GPT-4o',
    inputPer1M: 2.50,   // $2.50 per 1M input tokens
    outputPer1M: 10.00, // $10.00 per 1M output tokens
    model: 'gpt-4o',
  },
};

// Replicate pricing (approximate, based on execution time)
export const REPLICATE_PRICING = {
  perSecond: 0.00039, // ~$0.00039/sec for typical GPU
  perMinute: 0.0234,  // ~$0.0234/min
};

// MiniMax pricing (approximate)
export const MINIMAX_PRICING = {
  perSong: 0.05, // ~$0.05 per song generation
  ttsPer10KChars: 0.035, // ~$0.035 per 10k characters (T2A async)
};

// ═══════════════════════════════════════════════════════════════════════════
// COST CALCULATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface LLMUsage {
  provider: 'deepseek' | 'claude' | 'openai';
  inputTokens: number;
  outputTokens: number;
  model?: string;
}

export interface ReplicateUsage {
  executionTimeMs: number;
  gpuType?: string;
}

export function calculateLLMCost(usage: LLMUsage): number {
  const pricing = LLM_PRICING[usage.provider];
  if (!pricing) {
    console.warn(`Unknown LLM provider: ${usage.provider}`);
    return 0;
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}

export function calculateReplicateCost(usage: ReplicateUsage): number {
  const seconds = usage.executionTimeMs / 1000;
  return seconds * REPLICATE_PRICING.perSecond;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE LOGGING
// ═══════════════════════════════════════════════════════════════════════════

export interface CostLogEntry {
  jobId: string;
  taskId?: string;
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  executionTimeMs?: number;
  costUsd: number;
  label?: string;
}

/**
 * Log a cost entry to the database
 */
export async function logCost(entry: CostLogEntry): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ [Cost] Cannot log cost - Supabase not configured');
    return false;
  }

  try {
    const { error } = await supabase.from('cost_logs').insert({
      job_id: entry.jobId,
      task_id: entry.taskId || null,
      provider: entry.provider,
      model: entry.model || null,
      input_tokens: entry.inputTokens || 0,
      output_tokens: entry.outputTokens || 0,
      execution_time_ms: entry.executionTimeMs || 0,
      cost_usd: entry.costUsd,
      label: entry.label || null,
    });

    if (error) {
      console.error('❌ [Cost] Failed to log cost:', error.message);
      return false;
    }

    console.log(`💰 [Cost] Logged $${entry.costUsd.toFixed(6)} for ${entry.provider}${entry.label ? ` (${entry.label})` : ''}`);
    return true;
  } catch (err: any) {
    console.error('❌ [Cost] Error logging cost:', err.message);
    return false;
  }
}

/**
 * Log LLM cost with automatic calculation
 */
export async function logLLMCost(
  jobId: string,
  taskId: string | undefined,
  usage: LLMUsage,
  label?: string
): Promise<number> {
  const tiers = await getPricingTiers();
  let cost = 0;
  let modelToLog = usage.model || LLM_PRICING[usage.provider]?.model;

  if (tiers[usage.provider]) {
    const tier = tiers[usage.provider];
    const inputCost = (usage.inputTokens / 1_000_000) * parseFloat(tier.input_per_1m || '0');
    const outputCost = (usage.outputTokens / 1_000_000) * parseFloat(tier.output_per_1m || '0');
    cost = inputCost + outputCost;
    if (!usage.model && tier.model_name) modelToLog = tier.model_name;
  } else {
    cost = calculateLLMCost(usage); // Fallback
  }

  await logCost({
    jobId,
    taskId,
    provider: usage.provider,
    model: modelToLog,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: cost,
    label,
  });

  return cost;
}

/**
 * Log Replicate cost with automatic calculation
 */
export async function logReplicateCost(
  jobId: string,
  taskId: string | undefined,
  executionTimeMs: number,
  label?: string
): Promise<number> {
  const tiers = await getPricingTiers();
  let cost = 0;

  if (tiers['replicate']) {
    const tier = tiers['replicate'];
    const seconds = executionTimeMs / 1000;
    cost = seconds * parseFloat(tier.per_second || '0');
  } else {
    cost = calculateReplicateCost({ executionTimeMs }); // Fallback
  }

  await logCost({
    jobId,
    taskId,
    provider: 'replicate',
    executionTimeMs,
    costUsd: cost,
    label,
  });

  return cost;
}

/**
 * Log MiniMax TTS cost with automatic calculation
 */
export async function logMinimaxTtsCost(
  jobId: string,
  taskId: string | undefined,
  charsLength: number,
  label?: string
): Promise<number> {
  const tiers = await getPricingTiers();
  let cost = 0;

  if (tiers['minimax']) {
    const tier = tiers['minimax'];
    cost = (charsLength / 10000) * parseFloat(tier.tts_per_10k_chars || '0');
  } else {
    cost = (charsLength / 10000) * MINIMAX_PRICING.ttsPer10KChars;
  }

  await logCost({
    jobId,
    taskId,
    provider: 'minimax',
    costUsd: cost,
    label: label || 'TTS Generation',
  });

  return cost;
}

/**
 * Log Google AI Studio (Portraits) cost
 */
export async function logGoogleAiStudioCost(
  jobId: string,
  taskId: string | undefined,
  numImages: number,
  label?: string
): Promise<number> {
  const tiers = await getPricingTiers();
  let cost = 0;
  let modelToLog = 'gemini-3-pro-image-preview'; // Default fallback

  if (tiers['google_ai_studio']) {
    const tier = tiers['google_ai_studio'];
    cost = numImages * parseFloat(tier.per_item || '0');
    if (tier.model_name) modelToLog = tier.model_name;
  } else {
    cost = numImages * 0.05; // Fallback
  }

  await logCost({
    jobId,
    taskId,
    provider: 'google_ai_studio',
    costUsd: cost,
    model: modelToLog,
    label: label || 'AI Portrait Generation',
  });

  return cost;
}

/**
 * Log Google TTS cost
 */
export async function logGoogleTtsCost(
  jobId: string,
  taskId: string | undefined,
  charsLength: number,
  label?: string
): Promise<number> {
  const tiers = await getPricingTiers();
  let cost = 0;
  let modelToLog = 'chirp-3-hd'; // Default fallback

  if (tiers['google_tts']) {
    const tier = tiers['google_tts'];
    cost = (charsLength / 10000) * parseFloat(tier.tts_per_10k_chars || '0');
    if (tier.model_name) modelToLog = tier.model_name;
  } else {
    cost = (charsLength / 10000) * 0.16; // $0.16 per 10k chars fallback
  }

  await logCost({
    jobId,
    taskId,
    provider: 'google_tts',
    costUsd: cost,
    model: modelToLog,
    label: label || 'Google TTS',
  });

  return cost;
}

// Legacy alias for backward compatibility
export const logRunPodCost = logReplicateCost;
export const calculateRunPodCost = calculateReplicateCost;

// ═══════════════════════════════════════════════════════════════════════════
// COST REPORTING
// ═══════════════════════════════════════════════════════════════════════════

export interface CostSummary {
  totalCost: number;
  byProvider: Record<string, number>;
  byJob: Array<{
    jobId: string;
    jobType: string;
    totalCost: number;
    createdAt: string;
  }>;
  period: {
    start: string;
    end: string;
  };
}

/**
 * Get cost summary for a date range
 */
export async function getCostSummary(
  startDate: Date,
  endDate: Date
): Promise<CostSummary | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  try {
    // Get all cost logs in range
    const { data: logs, error } = await supabase
      .from('cost_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cost logs:', error);
      return null;
    }

    // Calculate totals
    let totalCost = 0;
    const byProvider: Record<string, number> = {};
    const byJobId: Record<string, number> = {};

    for (const log of logs || []) {
      const cost = parseFloat(log.cost_usd) || 0;
      totalCost += cost;
      byProvider[log.provider] = (byProvider[log.provider] || 0) + cost;
      if (log.job_id) {
        byJobId[log.job_id] = (byJobId[log.job_id] || 0) + cost;
      }
    }

    // Get job details for top jobs
    const topJobIds = Object.entries(byJobId)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 20)
      .map(([id]) => id);

    let byJob: CostSummary['byJob'] = [];
    if (topJobIds.length > 0) {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, type, created_at')
        .in('id', topJobIds);

      byJob = (jobs || []).map((job: any) => ({
        jobId: job.id,
        jobType: job.type,
        totalCost: byJobId[job.id] || 0,
        createdAt: job.created_at,
      })).sort((a: { totalCost: number }, b: { totalCost: number }) => b.totalCost - a.totalCost);
    }

    return {
      totalCost,
      byProvider,
      byJob,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  } catch (err: any) {
    console.error('Error getting cost summary:', err);
    return null;
  }
}

/**
 * Get today's costs
 */
export async function getTodayCosts(): Promise<CostSummary | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getCostSummary(today, tomorrow);
}

/**
 * Get this month's costs
 */
export async function getMonthCosts(): Promise<CostSummary | null> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return getCostSummary(firstDay, lastDay);
}
