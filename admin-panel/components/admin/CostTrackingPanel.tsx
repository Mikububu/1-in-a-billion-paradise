'use client';

import React, { useEffect, useState } from 'react';

interface CostSummary {
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

interface CostLog {
  id: string;
  job_id: string;
  task_id: string | null;
  provider: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  execution_time_ms: number;
  cost_usd: string;
  label: string | null;
  created_at: string;
}

interface Pricing {
  llm: Record<string, {
    name: string;
    inputPer1M: number;
    outputPer1M: number;
    model: string;
  }>;
  runpod: {
    perSecond: number;
    perMinute: number;
  };
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'bg-purple-100 text-purple-800',
  deepseek: 'bg-blue-100 text-blue-800',
  openai: 'bg-green-100 text-green-800',
  runpod: 'bg-pink-100 text-pink-800',
  minimax: 'bg-orange-100 text-orange-800',
};

const PROVIDER_ICONS: Record<string, string> = {
  claude: '🧠',
  deepseek: '🔮',
  openai: '🤖',
  runpod: '🎤',
  minimax: '🎵',
};

export function CostTrackingPanel() {
  const [todayCosts, setTodayCosts] = useState<CostSummary | null>(null);
  const [monthCosts, setMonthCosts] = useState<CostSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<CostLog[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'month' | 'logs'>('today');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [todayRes, monthRes, logsRes, pricingRes] = await Promise.all([
        fetch('/api/admin/costs/today', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
        }),
        fetch('/api/admin/costs/month', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
        }),
        fetch('/api/admin/costs/logs?limit=50', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
        }),
        fetch('/api/admin/costs/pricing', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
        }),
      ]);

      if (todayRes.ok) setTodayCosts(await todayRes.json());
      if (monthRes.ok) setMonthCosts(await monthRes.json());
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setRecentLogs(logsData.logs || []);
      }
      if (pricingRes.ok) setPricing(await pricingRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    if (cost < 1) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
    return tokens.toString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg"></div>
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
          <h3 className="font-semibold">Error loading costs</h3>
          <p className="text-sm">{error}</p>
          <button onClick={fetchAll} className="mt-2 text-sm text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
          <div className="text-sm opacity-80">Today's Costs</div>
          <div className="text-3xl font-bold">{formatCost(todayCosts?.totalCost || 0)}</div>
          <div className="text-sm mt-2 opacity-80">
            {Object.keys(todayCosts?.byProvider || {}).length} providers used
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
          <div className="text-sm opacity-80">This Month</div>
          <div className="text-3xl font-bold">{formatCost(monthCosts?.totalCost || 0)}</div>
          <div className="text-sm mt-2 opacity-80">
            {monthCosts?.byJob?.length || 0} jobs tracked
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
          <div className="text-sm opacity-80">Avg Cost/Job</div>
          <div className="text-3xl font-bold">
            {formatCost(monthCosts?.byJob?.length 
              ? (monthCosts.totalCost / monthCosts.byJob.length) 
              : 0
            )}
          </div>
          <div className="text-sm mt-2 opacity-80">this month</div>
        </div>
      </div>

      {/* Provider Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">💰 Cost Breakdown by Provider</h2>
          <button 
            onClick={fetchAll}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>
        <div className="p-6">
          {/* Tabs */}
          <div className="flex space-x-2 mb-4">
            {(['today', 'month'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  activeTab === tab
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab === 'today' ? "Today's Costs" : "This Month"}
              </button>
            ))}
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                activeTab === 'logs'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Recent Logs
            </button>
          </div>

          {/* Provider bars */}
          {activeTab !== 'logs' && (
            <div className="space-y-3">
              {Object.entries((activeTab === 'today' ? todayCosts : monthCosts)?.byProvider || {})
                .sort((a, b) => b[1] - a[1])
                .map(([provider, cost]) => {
                  const total = (activeTab === 'today' ? todayCosts : monthCosts)?.totalCost || 1;
                  const percent = (cost / total) * 100;
                  return (
                    <div key={provider} className="relative">
                      <div className="flex justify-between items-center mb-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span>{PROVIDER_ICONS[provider] || '⚙️'}</span>
                          <span className="capitalize">{provider}</span>
                        </span>
                        <span className="text-sm font-semibold">{formatCost(cost)}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            provider === 'claude' ? 'bg-purple-500' :
                            provider === 'deepseek' ? 'bg-blue-500' :
                            provider === 'openai' ? 'bg-green-500' :
                            provider === 'runpod' ? 'bg-pink-500' :
                            'bg-gray-500'
                          }`}
                          style={{ width: `${Math.max(percent, 2)}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{percent.toFixed(1)}% of total</div>
                    </div>
                  );
                })}
              {Object.keys((activeTab === 'today' ? todayCosts : monthCosts)?.byProvider || {}).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No costs recorded yet
                </div>
              )}
            </div>
          )}

          {/* Recent Logs */}
          {activeTab === 'logs' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tokens</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${PROVIDER_COLORS[log.provider] || 'bg-gray-100'}`}>
                          {PROVIDER_ICONS[log.provider] || '⚙️'} {log.provider}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className="text-gray-500">{formatTokens(log.input_tokens)}</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="text-gray-700">{formatTokens(log.output_tokens)}</span>
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        {formatCost(parseFloat(log.cost_usd))}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">
                        {log.label || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentLogs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No cost logs yet
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pricing Reference */}
      {pricing && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">📊 Current Pricing (per 1M tokens)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(pricing.llm).map(([key, p]) => (
              <div key={key} className={`p-4 rounded-lg border ${
                key === 'claude' ? 'border-purple-200 bg-purple-50' :
                key === 'deepseek' ? 'border-blue-200 bg-blue-50' :
                'border-green-200 bg-green-50'
              }`}>
                <div className="font-medium">{PROVIDER_ICONS[key]} {p.name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  Input: ${p.inputPer1M.toFixed(2)}/1M
                </div>
                <div className="text-sm text-gray-600">
                  Output: ${p.outputPer1M.toFixed(2)}/1M
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-lg border border-pink-200 bg-pink-50">
            <div className="font-medium">🎤 RunPod (Audio)</div>
            <div className="text-sm text-gray-600">
              ${pricing.runpod.perSecond.toFixed(5)}/sec • ${pricing.runpod.perMinute.toFixed(4)}/min
            </div>
          </div>
        </div>
      )}

      {/* Top Jobs This Month */}
      {monthCosts?.byJob && monthCosts.byJob.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">📈 Top Jobs by Cost (This Month)</h3>
          </div>
          <div className="p-6">
            <div className="space-y-2">
              {monthCosts.byJob.slice(0, 10).map((job, i) => (
                <div key={job.jobId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 font-mono text-sm">#{i + 1}</span>
                    <div>
                      <div className="text-sm font-medium">{job.jobType}</div>
                      <div className="text-xs text-gray-500">{job.jobId.slice(0, 8)}...</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{formatCost(job.totalCost)}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
