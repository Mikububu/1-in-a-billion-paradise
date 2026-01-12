/**
 * RUNPOD AUTO-SCALER
 * 
 * Monitors Supabase queue depth and scales RunPod workers up/down automatically.
 * 
 * Scaling logic:
 * - 0 pending tasks → 0 workers (save money)
 * - 1-10 pending → 1 worker
 * - 11-50 pending → 2-5 workers
 * - 51-200 pending → 5-20 workers
 * - 201+ pending → 20-50 workers (max)
 * 
 * Runs every 30 seconds to check queue depth and adjust workers.
 */

import { jobQueueV2 } from './jobQueueV2';
import { env } from '../config/env';
import axios from 'axios';
import { apiKeys } from './apiKeysHelper';

const RUNPOD_API_URL = 'https://api.runpod.ai/v2';
const SCALING_INTERVAL_MS = 30000; // 30 seconds
const WORKER_ENDPOINT_ID = process.env.RUNPOD_WORKER_ENDPOINT_ID || process.env.RUNPOD_ENDPOINT_ID || env.RUNPOD_ENDPOINT_ID || '';

interface ScalingConfig {
  minWorkers: number;
  maxWorkers: number;
  targetWorkers: number;
}

/**
 * Calculate target worker count based on pending tasks
 */
function calculateWorkers(pendingTasks: number): ScalingConfig {
  if (pendingTasks === 0) {
    return { minWorkers: 0, maxWorkers: 0, targetWorkers: 0 };
  }
  
  if (pendingTasks <= 10) {
    return { minWorkers: 1, maxWorkers: 1, targetWorkers: 1 };
  }
  
  if (pendingTasks <= 50) {
    const workers = Math.ceil(pendingTasks / 10);
    return { minWorkers: 2, maxWorkers: 5, targetWorkers: Math.min(workers, 5) };
  }
  
  if (pendingTasks <= 200) {
    const workers = Math.ceil(pendingTasks / 10);
    return { minWorkers: 5, maxWorkers: 20, targetWorkers: Math.min(workers, 20) };
  }
  
  // 201+ pending tasks
  const workers = Math.ceil(pendingTasks / 10);
  return { minWorkers: 20, maxWorkers: 50, targetWorkers: Math.min(workers, 50) };
}

/**
 * Scale RunPod endpoint workers
 */
async function scaleWorkers(config: ScalingConfig): Promise<boolean> {
  // Fetch RunPod keys from Supabase (with env fallback)
  let runpodKey: string;
  let runpodEndpoint: string;
  
  try {
    runpodKey = await apiKeys.runpod();
    runpodEndpoint = await apiKeys.runpodEndpoint();
  } catch (err) {
    // Fallback to env vars
    runpodKey = env.RUNPOD_API_KEY || process.env.RUNPOD_API_KEY || '';
    runpodEndpoint = WORKER_ENDPOINT_ID || env.RUNPOD_ENDPOINT_ID || process.env.RUNPOD_ENDPOINT_ID || '';
  }

  if (!runpodEndpoint || !runpodKey) {
    console.warn('⚠️ RunPod scaling disabled: Missing RUNPOD_ENDPOINT_ID or RUNPOD_API_KEY');
    return false;
  }

  try {
    // Guard rail: refuse to touch the wrong endpoint if env guards are configured.
    const guardNameContains = (env as any).RUNPOD_ENDPOINT_GUARD_NAME_CONTAINS || process.env.RUNPOD_ENDPOINT_GUARD_NAME_CONTAINS || '';
    const guardTemplateId = (env as any).RUNPOD_ENDPOINT_GUARD_TEMPLATE_ID || process.env.RUNPOD_ENDPOINT_GUARD_TEMPLATE_ID || '';
    if (guardNameContains || guardTemplateId) {
      try {
        const infoRes = await axios.get(`${RUNPOD_API_URL}/serverless/${runpodEndpoint}`, {
          headers: {
            'Authorization': `Bearer ${runpodKey}`,
            'Content-Type': 'application/json',
          },
        });

        const endpointInfo = infoRes.data || {};
        const endpointName = String(endpointInfo?.name || endpointInfo?.endpointName || endpointInfo?.endpoint_name || '');
        const templateId = String(endpointInfo?.templateId || endpointInfo?.template_id || '');

        if (guardNameContains && !endpointName.toLowerCase().includes(String(guardNameContains).toLowerCase())) {
          console.error(
            `🛑 RunPod guard blocked scaling: endpoint "${endpointName}" does not include "${guardNameContains}". Check RUNPOD_ENDPOINT_ID.`
          );
          return false;
        }

        if (guardTemplateId && templateId !== String(guardTemplateId)) {
          console.error(
            `🛑 RunPod guard blocked scaling: endpoint templateId "${templateId}" !== expected "${guardTemplateId}". Check RUNPOD_ENDPOINT_ID.`
          );
          return false;
        }
      } catch (guardErr: any) {
        console.warn('⚠️ RunPod guard check failed (continuing to avoid outages):', guardErr?.message || String(guardErr));
      }
    }

    const response = await axios.put(
      `${RUNPOD_API_URL}/serverless/${runpodEndpoint}`,
      {
        workersMin: config.minWorkers,
        workersMax: config.maxWorkers,
        workersIdle: config.targetWorkers,
      },
      {
        headers: {
          'Authorization': `Bearer ${runpodKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 200) {
      console.log(`📈 Scaled workers: ${config.targetWorkers} (min: ${config.minWorkers}, max: ${config.maxWorkers})`);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('❌ Failed to scale RunPod workers:', error.message);
    return false;
  }
}

/**
 * Check queue and scale workers
 */
export async function checkAndScale(): Promise<void> {
  try {
    const stats = await jobQueueV2.getQueueStats();
    const { pendingTasks } = stats;
    
    const config = calculateWorkers(pendingTasks);
    
    console.log(`📊 Queue depth: ${pendingTasks} pending tasks → Target workers: ${config.targetWorkers}`);
    
    await scaleWorkers(config);
  } catch (error: any) {
    console.error('❌ Auto-scaling check failed:', error.message);
  }
}

/**
 * Start auto-scaling loop
 */
export async function startAutoScaling(): Promise<void> {
  // Fetch keys from Supabase (with env fallback)
  let runpodEndpoint: string;
  try {
    runpodEndpoint = await apiKeys.runpodEndpoint();
  } catch (err) {
    runpodEndpoint = WORKER_ENDPOINT_ID || env.RUNPOD_ENDPOINT_ID || process.env.RUNPOD_ENDPOINT_ID || '';
  }

  if (!runpodEndpoint) {
    console.warn('⚠️ Auto-scaling disabled: Missing RUNPOD_ENDPOINT_ID');
    return;
  }

  console.log('🚀 Starting RunPod auto-scaler...');
  console.log(`   Endpoint: ${runpodEndpoint}`);
  console.log(`   Check interval: ${SCALING_INTERVAL_MS / 1000}s`);

  // Initial check
  checkAndScale();

  // Periodic checks
  setInterval(checkAndScale, SCALING_INTERVAL_MS);
}

