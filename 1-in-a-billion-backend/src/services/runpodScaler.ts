/**
 * RUNPOD AUTO-SCALER
 * 
 * Monitors Supabase queue depth and scales RunPod workers up/down automatically.
 * Uses RunPod GraphQL API for scaling.
 * 
 * Scaling logic (limited by account quota of ~10 workers):
 * - 0 pending tasks → min=0, max=1 (standby)
 * - 1-5 pending → min=1, max=2
 * - 6-20 pending → min=1, max=5
 * - 21+ pending → min=2, max=9 (account max)
 * 
 * Runs every 30 seconds to check queue depth and adjust workers.
 */

import { jobQueueV2 } from './jobQueueV2';
import { env } from '../config/env';
import axios from 'axios';
import { apiKeys } from './apiKeysHelper';

const RUNPOD_GRAPHQL_URL = 'https://api.runpod.io/graphql';
const SCALING_INTERVAL_MS = 30000; // 30 seconds
const MAX_ACCOUNT_WORKERS = 9; // Account quota limit

// Endpoint config (fetched once at startup)
let endpointConfig: { name: string; gpuIds: string } | null = null;

interface ScalingConfig {
  minWorkers: number;
  maxWorkers: number;
}

/**
 * Calculate target worker count based on pending tasks
 * Constrained by account quota (~10 workers)
 */
function calculateWorkers(pendingTasks: number): ScalingConfig {
  if (pendingTasks === 0) {
    return { minWorkers: 0, maxWorkers: 1 }; // Standby mode
  }
  
  if (pendingTasks <= 5) {
    return { minWorkers: 1, maxWorkers: 2 };
  }
  
  if (pendingTasks <= 20) {
    return { minWorkers: 1, maxWorkers: 5 };
  }
  
  // 21+ pending tasks - use maximum available
  return { minWorkers: 2, maxWorkers: MAX_ACCOUNT_WORKERS };
}

/**
 * Fetch endpoint config (name, gpuIds) - needed for GraphQL mutation
 */
async function fetchEndpointConfig(runpodKey: string, endpointId: string): Promise<{ name: string; gpuIds: string } | null> {
  try {
    const res = await axios.post(RUNPOD_GRAPHQL_URL, {
      query: `
        query {
          myself {
            endpoints {
              id
              name
              gpuIds
            }
          }
        }
      `
    }, {
      headers: {
        'Authorization': `Bearer ${runpodKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    const endpoints = res.data?.data?.myself?.endpoints || [];
    const endpoint = endpoints.find((e: any) => e.id === endpointId);
    
    if (endpoint) {
      return { name: endpoint.name, gpuIds: endpoint.gpuIds };
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Scale RunPod endpoint workers using GraphQL API
 */
async function scaleWorkers(config: ScalingConfig): Promise<boolean> {
  // Fetch RunPod keys from Supabase (with env fallback)
  let runpodKey: string;
  let runpodEndpoint: string;
  
  try {
    runpodKey = await apiKeys.runpod();
    runpodEndpoint = await apiKeys.runpodEndpoint();
  } catch (err) {
    runpodKey = env.RUNPOD_API_KEY || process.env.RUNPOD_API_KEY || '';
    runpodEndpoint = env.RUNPOD_ENDPOINT_ID || process.env.RUNPOD_ENDPOINT_ID || '';
  }

  if (!runpodEndpoint || !runpodKey) {
    console.warn('⚠️ RunPod scaling disabled: Missing RUNPOD_ENDPOINT_ID or RUNPOD_API_KEY');
    return false;
  }

  try {
    // Fetch endpoint config if not cached
    if (!endpointConfig) {
      endpointConfig = await fetchEndpointConfig(runpodKey, runpodEndpoint);
      if (!endpointConfig) {
        console.error('❌ Could not fetch endpoint config for scaling');
        return false;
      }
      console.log(`📋 Endpoint config loaded: ${endpointConfig.name} (${endpointConfig.gpuIds})`);
    }

    // Use GraphQL mutation to update endpoint
    const response = await axios.post(RUNPOD_GRAPHQL_URL, {
      query: `
        mutation {
          saveEndpoint(input: {
            id: "${runpodEndpoint}"
            name: "${endpointConfig.name}"
            gpuIds: "${endpointConfig.gpuIds}"
            workersMin: ${config.minWorkers}
            workersMax: ${config.maxWorkers}
            idleTimeout: 10
          }) {
            id
            workersMin
            workersMax
          }
        }
      `
    }, {
      headers: {
        'Authorization': `Bearer ${runpodKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    if (response.data?.errors) {
      console.error('❌ GraphQL scaling error:', response.data.errors[0]?.message);
      return false;
    }

    const result = response.data?.data?.saveEndpoint;
    if (result) {
      console.log(`📈 Scaled workers: min=${result.workersMin}, max=${result.workersMax}`);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('❌ Failed to scale RunPod workers:', error.message);
    return false;
  }
}

// Track last scaling config to avoid redundant API calls
let lastScalingConfig: ScalingConfig | null = null;

/**
 * Check queue and scale workers
 */
export async function checkAndScale(): Promise<void> {
  try {
    const stats = await jobQueueV2.getQueueStats();
    const { pendingTasks } = stats;
    
    const config = calculateWorkers(pendingTasks);
    
    // Only scale if config changed
    if (lastScalingConfig && 
        lastScalingConfig.minWorkers === config.minWorkers && 
        lastScalingConfig.maxWorkers === config.maxWorkers) {
      // No change needed
      return;
    }
    
    console.log(`📊 Queue: ${pendingTasks} tasks → Scaling to min=${config.minWorkers}, max=${config.maxWorkers}`);
    
    const success = await scaleWorkers(config);
    if (success) {
      lastScalingConfig = config;
    }
  } catch (error: any) {
    console.error('❌ Auto-scaling check failed:', error.message);
  }
}

/**
 * Start auto-scaling loop
 */
export async function startAutoScaling(): Promise<void> {
  let runpodEndpoint: string;
  try {
    runpodEndpoint = await apiKeys.runpodEndpoint();
  } catch (err) {
    runpodEndpoint = env.RUNPOD_ENDPOINT_ID || process.env.RUNPOD_ENDPOINT_ID || '';
  }

  if (!runpodEndpoint) {
    console.warn('⚠️ Auto-scaling disabled: Missing RUNPOD_ENDPOINT_ID');
    return;
  }

  console.log('🚀 Starting RunPod auto-scaler (GraphQL API)...');
  console.log(`   Endpoint: ${runpodEndpoint}`);
  console.log(`   Check interval: ${SCALING_INTERVAL_MS / 1000}s`);
  console.log(`   Max workers: ${MAX_ACCOUNT_WORKERS} (account limit)`);

  // Initial check
  await checkAndScale();

  // Periodic checks
  setInterval(checkAndScale, SCALING_INTERVAL_MS);
}

