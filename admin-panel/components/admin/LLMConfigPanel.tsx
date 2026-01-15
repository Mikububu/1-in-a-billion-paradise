'use client';

import React, { useEffect, useState } from 'react';

interface LLMConfig {
  providers: Record<string, string>;
  available: string[];
  current_default: string;
  current_paid: string;
  note: string;
}

const SYSTEM_LABELS: Record<string, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic Astrology (Jyotish)',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
  verdict: 'Final Verdict',
};

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'bg-purple-100 text-purple-800 border-purple-300',
  deepseek: 'bg-blue-100 text-blue-800 border-blue-300',
  openai: 'bg-green-100 text-green-800 border-green-300',
};

const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude Sonnet 4',
  deepseek: 'DeepSeek',
  openai: 'OpenAI GPT-4o',
};

export function LLMConfigPanel() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/llm/config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch LLM config');
      }
      
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
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
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
          <h3 className="font-semibold">Error loading LLM config</h3>
          <p className="text-sm">{error}</p>
          <button 
            onClick={fetchConfig}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">LLM Provider Configuration</h2>
        <p className="text-sm text-gray-500 mt-1">
          Current provider assignments for each reading system
        </p>
      </div>

      <div className="p-6">
        {/* Current instances info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Default (Hook Readings):</span>
              <span className={`ml-2 px-2 py-1 rounded border ${PROVIDER_COLORS[config.current_default]}`}>
                {PROVIDER_LABELS[config.current_default] || config.current_default}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Paid (Deep Readings):</span>
              <span className={`ml-2 px-2 py-1 rounded border ${PROVIDER_COLORS[config.current_paid]}`}>
                {PROVIDER_LABELS[config.current_paid] || config.current_paid}
              </span>
            </div>
          </div>
        </div>

        {/* System providers table */}
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  System
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(config.providers).map(([system, provider]) => (
                <tr key={system} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {SYSTEM_LABELS[system] || system}
                    </div>
                    <div className="text-xs text-gray-500">{system}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${PROVIDER_COLORS[provider]}`}>
                      {PROVIDER_LABELS[provider] || provider}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Note */}
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Configuration Note</h3>
              <p className="mt-1 text-sm text-amber-700">{config.note}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
