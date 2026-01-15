'use client';

import React, { useEffect, useState } from 'react';

interface Subscription {
  id: string;
  user_id: string | null;
  email: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  included_reading_used: boolean;
  included_reading_system: string | null;
  included_reading_job_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
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
  cancelled: 'bg-red-100 text-red-800',
  past_due: 'bg-yellow-100 text-yellow-800',
  incomplete: 'bg-gray-100 text-gray-800',
};

const SYSTEM_LABELS: Record<string, string> = {
  western: 'Western',
  vedic: 'Vedic',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
};

export function SubscriptionsPanel() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [readingFilter, setReadingFilter] = useState<string>('');

  useEffect(() => {
    fetchSubscriptions();
    fetchStats();
  }, [page, statusFilter, readingFilter]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (statusFilter) params.append('status', statusFilter);
      if (readingFilter) params.append('includedReadingUsed', readingFilter);

      const response = await fetch(`/api/admin/subscriptions?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      
      const data = await response.json();
      setSubscriptions(data.subscriptions);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/subscriptions/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleResetReading = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s included reading? They will be able to generate a new one.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}/reset-reading`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to reset reading');
      
      // Refresh data
      fetchSubscriptions();
      fetchStats();
    } catch (err: any) {
      alert('Failed to reset reading: ' + err.message);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Active Subscriptions</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_active}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Readings Used</div>
            <div className="text-2xl font-bold text-green-600">{stats.included_readings.used}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Readings Available</div>
            <div className="text-2xl font-bold text-blue-600">{stats.included_readings.available}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Usage Rate</div>
            <div className="text-2xl font-bold text-purple-600">
              {stats.total_active > 0 
                ? Math.round((stats.included_readings.used / stats.total_active) * 100) 
                : 0}%
            </div>
          </div>
        </div>
      )}

      {/* Readings by System */}
      {stats && Object.keys(stats.included_readings.by_system).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Readings by System</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.included_readings.by_system).map(([system, count]) => (
              <span key={system} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                {SYSTEM_LABELS[system] || system}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="past_due">Past Due</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Included Reading</label>
            <select
              value={readingFilter}
              onChange={(e) => { setReadingFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="true">Used</option>
              <option value="false">Not Used</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Subscriptions</h2>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reading</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period End</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{sub.email || '—'}</div>
                        <div className="text-xs text-gray-500">{sub.user_id?.slice(0, 8) || 'No user'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100'}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sub.included_reading_used ? (
                          <div>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Used: {SYSTEM_LABELS[sub.included_reading_system || ''] || sub.included_reading_system}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Available
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(sub.current_period_end)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(sub.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {sub.included_reading_used && (
                          <button
                            onClick={() => handleResetReading(sub.id)}
                            className="text-amber-600 hover:text-amber-800 font-medium"
                          >
                            Reset Reading
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
