'use client';

import React, { useEffect, useState } from 'react';
import { llmApi } from '../../lib/api/client';

interface LLMConfig {
  providers: Record<string, string>;
  available: string[];
  current_default: string;
  current_paid: string;
  note: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'bg-purple-100 text-purple-800 border-purple-200',
  deepseek: 'bg-blue-100 text-blue-800 border-blue-200',
  openai: 'bg-green-100 text-green-800 border-green-200',
};

const PROVIDER_ICONS: Record<string, string> = {
  claude: '🧠',
  deepseek: '🔮',
  openai: '🤖',
};

const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  western: 'Western Astrology readings (Sun signs, houses, aspects)',
  vedic: 'Vedic/Jyotish readings (Nakshatras, Dashas, Doshas)',
  human_design: 'Human Design charts (Type, Strategy, Authority)',
  gene_keys: 'Gene Keys interpretations (Shadows, Gifts, Siddhis)',
  kabbalah: 'Kabbalistic analysis (Tree of Life, Gematria)',
  verdict: 'Final synthesis combining all systems',
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
      setError(null);
      const result = await llmApi.getConfig();
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
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
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
      {/* Current Instances */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">🤖 Active LLM Instances</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="text-sm text-gray-500 mb-1">Default (Hook Readings)</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{PROVIDER_ICONS[config.current_default.toLowerCase()] || '⚙️'}</span>
                <span className="font-semibold text-lg">{config.current_default}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">Fast, cheap • Used for Sun/Moon/Rising</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-sm text-gray-500 mb-1">Paid (Deep Readings)</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{PROVIDER_ICONS[config.current_paid.toLowerCase()] || '⚙️'}</span>
                <span className="font-semibold text-lg">{config.current_paid}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">Quality focus • Used for Extended/Nuclear/Synastry</div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-System Configuration */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">⚙️ Per-System Provider Configuration</h2>
          <button 
            onClick={fetchConfig}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {Object.entries(config.providers).map(([system, provider]) => {
              const providerLower = (provider as string).toLowerCase();
              return (
                <div 
                  key={system}
                  className="flex items-center justify-between p-4 rounded-lg border bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium capitalize">{system.replace('_', ' ')}</div>
                    <div className="text-xs text-gray-500">{SYSTEM_DESCRIPTIONS[system] || ''}</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium border ${PROVIDER_COLORS[providerLower] || 'bg-gray-100'}`}>
                    {PROVIDER_ICONS[providerLower] || '⚙️'} {provider}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Available Providers */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-4">📋 Available Providers</h3>
        <div className="flex flex-wrap gap-3">
          {config.available.map((provider) => {
            const providerLower = provider.toLowerCase();
            return (
              <div 
                key={provider}
                className={`px-4 py-2 rounded-lg border ${PROVIDER_COLORS[providerLower] || 'bg-gray-100'}`}
              >
                {PROVIDER_ICONS[providerLower] || '⚙️'} {provider}
              </div>
            );
          })}
        </div>
      </div>

      {/* Configuration Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <h4 className="font-medium text-amber-900">How to Change Providers</h4>
            <p className="text-sm text-amber-800 mt-1">{config.note}</p>
            <div className="mt-2 text-xs text-amber-700">
              <code className="bg-amber-100 px-2 py-1 rounded">src/config/llmProviders.ts</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
