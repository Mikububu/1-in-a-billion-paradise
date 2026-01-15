/**
 * Admin Panel API Client
 * 
 * Connects to the 1-in-a-Billion backend API.
 * All admin endpoints require authentication via Bearer token.
 */

// Backend API URL - change based on environment
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://one-in-a-billion.fly.dev';

/**
 * Get the admin authentication token from localStorage
 */
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

/**
 * Set the admin authentication token
 */
export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_token', token);
}

/**
 * Clear the admin authentication token
 */
export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_token');
}

/**
 * Make an authenticated API request to the backend
 */
export async function adminFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();
  
  if (!token) {
    throw new Error('Not authenticated. Please log in.');
  }

  const url = `${API_BASE_URL}/api/admin${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    clearAdminToken();
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPED API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Dashboard
export const dashboardApi = {
  getStats: () => adminFetch('/dashboard/stats'),
};

// Users
export const usersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return adminFetch(`/users${query ? `?${query}` : ''}`);
  },
  get: (userId: string) => adminFetch(`/users/${userId}`),
  update: (userId: string, data: any) => adminFetch(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  addNote: (userId: string, note: string, isFlagged?: boolean, flagReason?: string) => 
    adminFetch(`/users/${userId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note, is_flagged: isFlagged, flag_reason: flagReason }),
    }),
};

// Jobs
export const jobsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; type?: string; userId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return adminFetch(`/jobs${query ? `?${query}` : ''}`);
  },
  get: (jobId: string) => adminFetch(`/jobs/${jobId}`),
  cancel: (jobId: string) => adminFetch(`/jobs/${jobId}/cancel`, { method: 'POST' }),
  getMetrics: () => adminFetch('/jobs/metrics'),
};

// Subscriptions
export const subscriptionsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; includedReadingUsed?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return adminFetch(`/subscriptions${query ? `?${query}` : ''}`);
  },
  get: (subscriptionId: string) => adminFetch(`/subscriptions/${subscriptionId}`),
  getStats: () => adminFetch('/subscriptions/stats'),
  resetReading: (subscriptionId: string) => adminFetch(`/subscriptions/${subscriptionId}/reset-reading`, {
    method: 'POST',
  }),
};

// LLM Config
export const llmApi = {
  getConfig: () => adminFetch('/llm/config'),
};

// Services
export const servicesApi = {
  getStatus: () => adminFetch('/services/status'),
  getRunpodDetailed: () => adminFetch('/services/runpod/detailed'),
};

// Queue
export const queueApi = {
  getStatus: () => adminFetch('/queue/status'),
};

// System
export const systemApi = {
  getConfig: () => adminFetch('/system/config'),
};

// Storage
export const storageApi = {
  getUsage: () => adminFetch('/storage/usage'),
};

// Costs
export const costsApi = {
  getToday: () => adminFetch('/costs/today'),
  getMonth: () => adminFetch('/costs/month'),
  getRange: (start: string, end: string) => adminFetch(`/costs/range?start=${start}&end=${end}`),
  getLogs: (params?: { limit?: number; provider?: string; jobId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return adminFetch(`/costs/logs${query ? `?${query}` : ''}`);
  },
  getPricing: () => adminFetch('/costs/pricing'),
  getByJob: (jobId: string) => adminFetch(`/costs/by-job/${jobId}`),
};
