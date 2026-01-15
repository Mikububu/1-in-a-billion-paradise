'use client';

import React, { useEffect, useState } from 'react';

interface SystemConfig {
  llm: {
    paidProvider: string;
    systemProviders: Record<string, string>;
    defaultInstance: string;
    paidInstance: string;
  };
  content: {
    tragicRealismLevel: number;
    tragicRealismDescription: string;
  };
  queue: {
    enabled: boolean;
    rolloutPercent: number;
  };
  worker: {
    maxConcurrentTasks: number;
    pollingIntervalMs: number;
    maxPollingIntervalMs: number;
  };
  features: {
    betaKeyEnabled: boolean;
    devAutoConfirmEmail: boolean;
  };
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'bg-purple-100 text-purple-800',
  deepseek: 'bg-blue-100 text-blue-800',
  openai: 'bg-green-100 text-green-800',
};

const SYSTEM_LABELS: Record<string, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic Astrology',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
  verdict: 'Final Verdict',
};

export function SystemConfigPanel() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/system/config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch config');
      
      const data = await response.json();
      setConfig(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
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
          <h3 className="font-semibold">Error loading config</h3>
          <p className="text-sm">{error}</p>
          <button onClick={fetchConfig} className="mt-2 text-sm text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      {/* LLM Configuration */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">🤖 LLM Provider Configuration</h2>
          <p className="text-sm text-gray-500">Which AI model generates each reading system</p>
        </div>
        <div className="p-6">
          {/* Current instances */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Hook Readings (fast):</span>
                <span className={`ml-2 px-2 py-1 rounded ${PROVIDER_COLORS[config.llm.defaultInstance] || 'bg-gray-100'}`}>
                  {config.llm.defaultInstance}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Deep Readings (quality):</span>
                <span className={`ml-2 px-2 py-1 rounded ${PROVIDER_COLORS[config.llm.paidInstance] || 'bg-gray-100'}`}>
                  {config.llm.paidInstance}
                </span>
              </div>
            </div>
          </div>

          {/* Per-system config */}
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(config.llm.systemProviders).map(([system, provider]) => (
                  <tr key={system} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {SYSTEM_LABELS[system] || system}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${PROVIDER_COLORS[provider] || 'bg-gray-100'}`}>
                        {provider === 'claude' ? 'Claude Sonnet 4' : provider === 'openai' ? 'GPT-4o' : 'DeepSeek'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Content Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">✍️ Content Settings</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
            <div>
              <div className="font-medium text-amber-900">Tragic Realism Level</div>
              <div className="text-sm text-amber-700">{config.content.tragicRealismDescription}</div>
            </div>
            <div className="text-3xl font-bold text-amber-900">
              {config.content.tragicRealismLevel}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {['Off', 'Subtle', 'Clear', 'Mythic'].map((level, i) => (
              <div 
                key={level}
                className={`p-2 text-center rounded text-sm ${
                  config.content.tragicRealismLevel === i 
                    ? 'bg-amber-200 text-amber-900 font-medium' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {i}: {level}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Queue Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">📋 Queue Settings</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${config.queue.enabled ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-sm text-gray-600">Supabase Queue</div>
              <div className={`text-lg font-semibold ${config.queue.enabled ? 'text-green-700' : 'text-red-700'}`}>
                {config.queue.enabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Rollout Percent</div>
              <div className="text-lg font-semibold text-gray-900">{config.queue.rolloutPercent}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Worker Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">⚙️ Worker Settings</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">{config.worker.maxConcurrentTasks}</div>
              <div className="text-sm text-blue-600">Max Concurrent Tasks</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">{config.worker.pollingIntervalMs}ms</div>
              <div className="text-sm text-blue-600">Polling Interval</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">{config.worker.maxPollingIntervalMs}ms</div>
              <div className="text-sm text-blue-600">Max Polling Interval</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">🚩 Feature Flags</h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">Beta Key Protection</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                config.features.betaKeyEnabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {config.features.betaKeyEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">Dev Auto-Confirm Email</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                config.features.devAutoConfirmEmail 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {config.features.devAutoConfirmEmail ? 'ON (DEV)' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
