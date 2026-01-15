'use client';

import React, { useEffect, useState } from 'react';
import { servicesApi } from '../../lib/api/client';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'error' | 'unknown';
  balance?: number | string;
  currency?: string;
  details?: any;
  error?: string;
}

interface ServicesResponse {
  services: ServiceStatus[];
  timestamp: string;
  environment: {
    tragicRealismLevel: number;
    paidLlmProvider: string;
    supabaseQueueEnabled: boolean;
  };
}

const STATUS_COLORS = {
  ok: 'bg-green-100 text-green-800 border-green-300',
  error: 'bg-red-100 text-red-800 border-red-300',
  unknown: 'bg-gray-100 text-gray-800 border-gray-300',
};

const SERVICE_ICONS: Record<string, string> = {
  'RunPod': '🎤',
  'Anthropic (Claude)': '🧠',
  'OpenAI': '🤖',
  'DeepSeek': '🔮',
  'MiniMax': '🎵',
  'Google Places': '📍',
  'Supabase Storage': '💾',
  'Stripe': '💳',
};

export function APIServicesPanel() {
  const [data, setData] = useState<ServicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runpodDetailed, setRunpodDetailed] = useState<any>(null);
  const [showRunpodDetails, setShowRunpodDetails] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await servicesApi.getStatus();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRunpodDetailed = async () => {
    try {
      const result = await servicesApi.getRunpodDetailed();
      setRunpodDetailed(result);
      setShowRunpodDetails(true);
    } catch (err: any) {
      alert('Failed to fetch RunPod details: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">
          <h3 className="font-semibold">Error loading services</h3>
          <p className="text-sm">{error}</p>
          <button onClick={fetchStatus} className="mt-2 text-sm text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Services Grid */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">🔌 API Services Status</h2>
            <p className="text-sm text-gray-500">Last updated: {new Date(data.timestamp).toLocaleString()}</p>
          </div>
          <button 
            onClick={fetchStatus}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.services.map((service) => (
              <div 
                key={service.name}
                className={`p-4 rounded-lg border-2 ${STATUS_COLORS[service.status]}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{SERVICE_ICONS[service.name] || '⚙️'}</span>
                  <h3 className="font-medium">{service.name}</h3>
                </div>
                
                <div className="text-sm">
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`w-2 h-2 rounded-full ${
                      service.status === 'ok' ? 'bg-green-500' : 
                      service.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                    }`}></span>
                    <span className="capitalize">{service.status}</span>
                  </div>
                  
                  {service.balance !== undefined && (
                    <div className="font-semibold">
                      {typeof service.balance === 'number' 
                        ? `$${service.balance.toFixed(2)}` 
                        : service.balance}
                    </div>
                  )}
                  
                  {service.error && (
                    <div className="text-xs text-red-600 mt-1 truncate" title={service.error}>
                      {service.error}
                    </div>
                  )}

                  {service.name === 'RunPod' && service.status === 'ok' && (
                    <button
                      onClick={fetchRunpodDetailed}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      View Details →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Environment Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Environment Configuration</h3>
        <div className="flex flex-wrap gap-3">
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
            LLM: {data.environment.paidLlmProvider}
          </span>
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
            Tragic Realism: Level {data.environment.tragicRealismLevel}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm ${
            data.environment.supabaseQueueEnabled 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            Queue: {data.environment.supabaseQueueEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* RunPod Detailed Modal */}
      {showRunpodDetails && runpodDetailed && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">🎤 RunPod Detailed Status</h3>
              <button 
                onClick={() => setShowRunpodDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Balance */}
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800">💰 Balance</h4>
                <div className="text-2xl font-bold text-green-900">
                  ${runpodDetailed.balance?.credits?.toFixed(2) || '0.00'}
                </div>
                <div className="text-sm text-green-700">
                  Current spend: ${runpodDetailed.balance?.currentSpendPerHr?.toFixed(4) || '0'}/hr
                </div>
              </div>

              {/* Current Endpoint */}
              {runpodDetailed.endpoint && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800">🔗 Active Endpoint</h4>
                  <div className="text-sm space-y-1 mt-2">
                    <div><strong>Name:</strong> {runpodDetailed.endpoint.name}</div>
                    <div><strong>ID:</strong> <code className="bg-blue-100 px-1 rounded">{runpodDetailed.endpoint.id}</code></div>
                    <div><strong>Workers:</strong> {runpodDetailed.endpoint.workersMin} - {runpodDetailed.endpoint.workersMax}</div>
                    <div><strong>Idle Timeout:</strong> {runpodDetailed.endpoint.idleTimeout}s</div>
                  </div>
                </div>
              )}

              {/* Recent Jobs */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-800">📊 Recent Jobs (Last 20)</h4>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{runpodDetailed.recentJobs?.completed || 0}</div>
                    <div className="text-xs text-gray-500">✅ Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{runpodDetailed.recentJobs?.failed || 0}</div>
                    <div className="text-xs text-gray-500">❌ Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{runpodDetailed.recentJobs?.avgExecutionTimeSec || 0}s</div>
                    <div className="text-xs text-gray-500">⏱️ Avg Time</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
