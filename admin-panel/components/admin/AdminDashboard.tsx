'use client';

import React, { useState, useEffect } from 'react';
import { APIServicesPanel } from './APIServicesPanel';
import { QueueStatusPanel } from './QueueStatusPanel';
import { LLMConfigPanel } from './LLMConfigPanel';
import { SubscriptionsPanel } from './SubscriptionsPanel';
import { SystemConfigPanel } from './SystemConfigPanel';
import { StorageUsagePanel } from './StorageUsagePanel';
import { CostTrackingPanel } from './CostTrackingPanel';
import { dashboardApi, getAdminToken, clearAdminToken } from '../../lib/api/client';

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

interface DashboardStats {
  users: { total: number };
  jobs: { total: number; completed: number };
  recent_activity: any[];
}

function OverviewTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardApi.getStats();
      setStats(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
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
          <h3 className="font-semibold">Error loading dashboard</h3>
          <p className="text-sm">{error}</p>
          <button onClick={fetchStats} className="mt-2 text-sm text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
          <div className="text-sm opacity-80">👥 Total Users</div>
          <div className="text-3xl font-bold">{stats?.users?.total || 0}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
          <div className="text-sm opacity-80">📋 Total Jobs</div>
          <div className="text-3xl font-bold">{stats?.jobs?.total || 0}</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
          <div className="text-sm opacity-80">✅ Completed Jobs</div>
          <div className="text-3xl font-bold">{stats?.jobs?.completed || 0}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow p-6 text-white">
          <div className="text-sm opacity-80">📈 Success Rate</div>
          <div className="text-3xl font-bold">
            {stats?.jobs?.total ? ((stats.jobs.completed / stats.jobs.total) * 100).toFixed(0) : 0}%
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-4">🚀 Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a 
            href="https://supabase.com/dashboard" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 text-center"
          >
            <div className="text-2xl mb-2">🗄️</div>
            <div className="text-sm font-medium">Supabase</div>
          </a>
          <a 
            href="https://fly.io/dashboard" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-4 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 text-center"
          >
            <div className="text-2xl mb-2">🚀</div>
            <div className="text-sm font-medium">Fly.io</div>
          </a>
          <a 
            href="https://www.runpod.io/console/pods" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-4 bg-pink-50 rounded-lg border border-pink-200 hover:bg-pink-100 text-center"
          >
            <div className="text-2xl mb-2">🎤</div>
            <div className="text-sm font-medium">RunPod</div>
          </a>
          <a 
            href="https://dashboard.stripe.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 text-center"
          >
            <div className="text-2xl mb-2">💳</div>
            <div className="text-sm font-medium">Stripe</div>
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      {stats?.recent_activity && stats.recent_activity.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">📝 Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recent_activity.slice(0, 10).map((activity, i) => (
              <div key={i} className="px-6 py-3 hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm font-medium">{activity.action || 'Activity'}</span>
                    <span className="text-xs text-gray-500 ml-2">{activity.user_id?.slice(0, 8)}...</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user has a token
    const token = getAdminToken();
    setIsAuthenticated(!!token);
    setChecking(false);
  }, []);

  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
    window.location.reload();
  };

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

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">🔐 Admin Login</h1>
          <p className="text-gray-600 mb-6 text-center">
            Please log in to access the admin panel.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Note:</strong> Admin authentication is handled via the backend API. 
            Contact the system administrator for access credentials.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌟</span>
            <h1 className="text-xl font-bold text-gray-900">1 in a Billion Admin</h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <nav className="mb-6">
          <div className="flex flex-wrap gap-2 bg-white rounded-lg shadow p-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Tab Content */}
        <main>{renderContent()}</main>
      </div>
    </div>
  );
}
