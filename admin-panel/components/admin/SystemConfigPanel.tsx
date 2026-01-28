'use client';

import React, { useEffect, useState } from 'react';
import { systemApi } from '../../lib/api/client';

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
      setError(null);
      const result = await systemApi.getConfig();
      setConfig(result);
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
              <div key={i} className="h-20 bg-gray-100 rounded-lg"></div>
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
          <h3 className="font-semibold">Error loading system config</h3>
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
          <h2 className="text-lg font-semibold text-gray-900">🤖 LLM Configuration</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Default Provider</div>
              <div className="text-lg font-semibold">{config.llm.defaultInstance}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-500">Paid Provider</div>
              <div className="text-lg font-semibold">{config.llm.paidInstance}</div>
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-2">Per-System Providers</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(config.llm.systemProviders).map(([system, provider]) => (
                <div key={system} className="flex justify-between items-center text-sm">
                  <span className="capitalize">{system.replace('_', ' ')}</span>
                  <span className="font-medium text-purple-600">{provider}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">📝 Content Settings</h2>
        </div>
        <div className="p-6">
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Tragic Realism Level</div>
                <div className="text-2xl font-bold text-amber-700">Level {config.content.tragicRealismLevel}</div>
                <div className="text-sm text-amber-600">{config.content.tragicRealismDescription}</div>
              </div>
              <div className="text-4xl">🎭</div>
            </div>
          </div>
        </div>
      </div>

      {/* Queue Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">📋 Queue Settings</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg ${config.queue.enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
              <div className="text-sm text-gray-500">Queue Status</div>
              <div className={`text-lg font-semibold ${config.queue.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                {config.queue.enabled ? '✓ Enabled' : '✗ Disabled'}
              </div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-500">Rollout %</div>
              <div className="text-lg font-semibold text-blue-700">{config.queue.rolloutPercent}%</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Max Concurrent</div>
              <div className="text-lg font-semibold">{config.worker.maxConcurrentTasks}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Poll Interval</div>
              <div className="text-lg font-semibold">{config.worker.pollingIntervalMs}ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">🚩 Feature Flags</h2>
          <button 
            onClick={fetchConfig}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Beta Key Protection</div>
                <div className="text-xs text-gray-500">Require beta key for access</div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm ${config.features.betaKeyEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {config.features.betaKeyEnabled ? '✓ Enabled' : 'Disabled'}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Dev Auto-Confirm Email</div>
                <div className="text-xs text-gray-500">Skip email verification in dev</div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm ${config.features.devAutoConfirmEmail ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                {config.features.devAutoConfirmEmail ? '⚠️ Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
