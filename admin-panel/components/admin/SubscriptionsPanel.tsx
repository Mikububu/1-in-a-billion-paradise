'use client';

import React, { useEffect, useState } from 'react';
import { subscriptionsApi } from '../../lib/api/client';

interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  included_reading_used: boolean;
  included_reading_system: string | null;
  included_reading_job_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SubscriptionStats {
  total_active: number;
  included_readings: {
    used: number;
    available: number;
    by_system: Record<string, number>;
  };
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  past_due: 'bg-red-100 text-red-800',
  incomplete: 'bg-yellow-100 text-yellow-800',
};

const SYSTEM_COLORS: Record<string, string> = {
  western: 'bg-blue-100 text-blue-800',
  vedic: 'bg-orange-100 text-orange-800',
  human_design: 'bg-purple-100 text-purple-800',
  gene_keys: 'bg-green-100 text-green-800',
  kabbalah: 'bg-indigo-100 text-indigo-800',
};

export function SubscriptionsPanel() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'used' | 'available'>('all');
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [filter]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = { limit: 50 };
      if (filter === 'used') params.includedReadingUsed = 'true';
      if (filter === 'available') params.includedReadingUsed = 'false';
      
      const [subsRes, statsRes] = await Promise.all([
        subscriptionsApi.list(params),
        subscriptionsApi.getStats(),
      ]);
      
      setSubscriptions(subsRes.subscriptions || []);
      setStats(statsRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetReading = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s included reading? They will be able to use it again.')) {
      return;
    }
    
    try {
      setResetting(subscriptionId);
      await subscriptionsApi.resetReading(subscriptionId);
      await fetchAll();
    } catch (err: any) {
      alert('Failed to reset reading: ' + err.message);
    } finally {
      setResetting(null);
    }
  };

  if (loading && subscriptions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
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
          <h3 className="font-semibold">Error loading subscriptions</h3>
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
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="text-sm opacity-80">💳 Active Subscriptions</div>
            <div className="text-3xl font-bold">{stats.total_active}</div>
            <div className="text-sm mt-2 opacity-80">$9.90/year each</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="text-sm opacity-80">📖 Readings Used</div>
            <div className="text-3xl font-bold">{stats.included_readings.used}</div>
            <div className="text-sm mt-2 opacity-80">included readings claimed</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow p-6 text-white">
            <div className="text-sm opacity-80">⏳ Readings Available</div>
            <div className="text-3xl font-bold">{stats.included_readings.available}</div>
            <div className="text-sm mt-2 opacity-80">pending use</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div className="text-sm opacity-80">💰 Est. Revenue</div>
            <div className="text-3xl font-bold">${(stats.total_active * 9.90).toFixed(0)}</div>
            <div className="text-sm mt-2 opacity-80">annual</div>
          </div>
        </div>
      )}

      {/* Readings by System */}
      {stats && Object.keys(stats.included_readings.by_system).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">📊 Readings Used by System</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.included_readings.by_system).map(([system, count]) => (
              <div 
                key={system}
                className={`px-4 py-2 rounded-lg ${SYSTEM_COLORS[system] || 'bg-gray-100'}`}
              >
                <span className="font-medium capitalize">{system.replace('_', ' ')}</span>
                <span className="ml-2 font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">💳 Subscriptions</h2>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="used">Reading Used</option>
              <option value="available">Reading Available</option>
            </select>
            <button 
              onClick={fetchAll}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period End</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reading</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{sub.user_id.slice(0, 8)}...</div>
                    <div className="text-xs text-gray-500">{sub.stripe_customer_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[sub.status] || 'bg-gray-100'}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(sub.current_period_end).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {sub.included_reading_used ? (
                      <div>
                        <span className={`px-2 py-1 rounded text-xs ${SYSTEM_COLORS[sub.included_reading_system || ''] || 'bg-gray-100'}`}>
                          ✓ {sub.included_reading_system?.replace('_', ' ') || 'Used'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Not used</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {sub.included_reading_used && (
                      <button
                        onClick={() => resetReading(sub.id)}
                        disabled={resetting === sub.id}
                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {resetting === sub.id ? 'Resetting...' : 'Reset Reading'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {subscriptions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No subscriptions found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
