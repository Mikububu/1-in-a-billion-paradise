'use client';

import React, { useState } from 'react';
import { APIServicesPanel } from './APIServicesPanel';
import { QueueStatusPanel } from './QueueStatusPanel';
import { LLMConfigPanel } from './LLMConfigPanel';
import { SubscriptionsPanel } from './SubscriptionsPanel';
import { SystemConfigPanel } from './SystemConfigPanel';
import { StorageUsagePanel } from './StorageUsagePanel';
import { CostTrackingPanel } from './CostTrackingPanel';

type TabId = 'overview' | 'costs' | 'services' | 'queue' | 'llm' | 'subscriptions' | 'storage' | 'config';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'costs', label: 'Costs', icon: '💰' },
  { id: 'services', label: 'API Services', icon: '🔌' },
  { id: 'queue', label: 'Job Queue', icon: '📋' },
  { id: 'llm', label: 'LLM Config', icon: '🤖' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '💳' },
  { id: 'storage', label: 'Storage', icon: '💾' },
  { id: 'config', label: 'System Config', icon: '⚙️' },
];

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'costs':
        return <CostTrackingPanel />;
      case 'services':
        return <APIServicesPanel />;
      case 'queue':
        return <QueueStatusPanel />;
      case 'llm':
        return <LLMConfigPanel />;
      case 'subscriptions':
        return <SubscriptionsPanel />;
      case 'storage':
        return <StorageUsagePanel />;
      case 'config':
        return <SystemConfigPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🌟</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">1 in a Billion</h1>
                <p className="text-sm text-gray-500">Admin Dashboard</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {renderContent()}
      </main>
    </div>
  );
}

// Overview Tab - Quick summary of everything
function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <QuickStatCard 
          title="API Services" 
          icon="🔌" 
          description="Check balances and status"
          color="blue"
        />
        <QuickStatCard 
          title="Job Queue" 
          icon="📋" 
          description="Monitor task processing"
          color="purple"
        />
        <QuickStatCard 
          title="Subscriptions" 
          icon="💳" 
          description="$9.90/year subscribers"
          color="green"
        />
        <QuickStatCard 
          title="Storage" 
          icon="💾" 
          description="Audio, PDFs, Songs"
          color="orange"
        />
      </div>

      {/* Recent Changes Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🆕 Recent System Changes (Jan 2026)</h2>
        <div className="space-y-3">
          <ChangeItem 
            title="Claude Sonnet 4 for Deep Readings"
            description="Switched from DeepSeek to Claude for overlay readings - more unhinged, psychologically deep content"
            date="Jan 15"
            type="llm"
          />
          <ChangeItem 
            title="Per-System LLM Provider Config"
            description="Each reading system (Western, Vedic, HD, Gene Keys, Kabbalah) can now use a different LLM provider"
            date="Jan 15"
            type="config"
          />
          <ChangeItem 
            title="Subscription Included Reading Tracking"
            description="$9.90/year subscription includes one free deep reading - now tracked in database"
            date="Jan 15"
            type="feature"
          />
          <ChangeItem 
            title="Post-Payment Name Input"
            description="After Stripe payment, users now enter their preferred display name before OAuth sign-in"
            date="Jan 14"
            type="ux"
          />
          <ChangeItem 
            title="Offer Screen Audio + Karaoke"
            description="3-page offer carousel now has David's voice audio with word-by-word yellow highlighting"
            date="Jan 14"
            type="ux"
          />
          <ChangeItem 
            title="Third Person Hook Reading Lock"
            description="Once generated, hook readings are cached and won't regenerate on revisit"
            date="Jan 13"
            type="feature"
          />
        </div>
      </div>

      {/* System Health Mini */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">🤖 LLM Provider Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
              <span>Claude (Anthropic)</span>
              <span className="text-purple-700 font-medium">Deep Readings</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
              <span>DeepSeek</span>
              <span className="text-blue-700 font-medium">Hook Readings</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-green-50 rounded">
              <span>OpenAI</span>
              <span className="text-green-700 font-medium">Kabbalah Only</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">📊 Content Settings</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-amber-50 rounded">
              <span>Tragic Realism Level</span>
              <span className="text-amber-700 font-medium">3 (Mythic)</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span>Supabase Queue</span>
              <span className="text-gray-700 font-medium">Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStatCard({ title, icon, description, color }: { 
  title: string; 
  icon: string; 
  description: string;
  color: 'blue' | 'purple' | 'green' | 'orange';
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${colors[color]}`}>
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm opacity-80">{description}</p>
    </div>
  );
}

function ChangeItem({ title, description, date, type }: {
  title: string;
  description: string;
  date: string;
  type: 'llm' | 'config' | 'feature' | 'ux';
}) {
  const typeColors = {
    llm: 'bg-purple-100 text-purple-700',
    config: 'bg-blue-100 text-blue-700',
    feature: 'bg-green-100 text-green-700',
    ux: 'bg-pink-100 text-pink-700',
  };

  const typeLabels = {
    llm: 'LLM',
    config: 'Config',
    feature: 'Feature',
    ux: 'UX',
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[type]}`}>
        {typeLabels[type]}
      </span>
      <div className="flex-1">
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
      <span className="text-xs text-gray-400">{date}</span>
    </div>
  );
}
