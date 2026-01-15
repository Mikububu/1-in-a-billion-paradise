'use client';

import React, { useEffect, useState } from 'react';

interface QueueStatus {
  byStatus: Record<string, number>;
  byTaskType: Record<string, number>;
  health: {
    stuckTasks: number;
    recentErrorRate: string;
    recentTotal: number;
    recentErrors: number;
  };
  timestamp: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  claimed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  complete: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
};

const TASK_COLORS: Record<string, string> = {
  text: 'bg-indigo-100 text-indigo-800',
  audio: 'bg-pink-100 text-pink-800',
  pdf: 'bg-orange-100 text-orange-800',
};

export function QueueStatusPanel() {
  const [data, setData] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/queue/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch queue status');
      
      const result = await response.json();
      setData(result);
      setError(null);
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
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
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
          <h3 className="font-semibold">Error loading queue status</h3>
          <p className="text-sm">{error}</p>
          <button onClick={fetchStatus} className="mt-2 text-sm text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalActive = (data.byStatus.pending || 0) + (data.byStatus.claimed || 0) + (data.byStatus.processing || 0);
  const errorRateNum = parseFloat(data.health.recentErrorRate);
  const isHealthy = data.health.stuckTasks === 0 && errorRateNum < 10;

  return (
    <div className="space-y-6">
      {/* Health Overview */}
      <div className={`rounded-lg shadow p-6 ${isHealthy ? 'bg-green-50' : 'bg-amber-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{isHealthy ? '✅' : '⚠️'}</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Queue Health: {isHealthy ? 'Healthy' : 'Attention Needed'}
              </h2>
              <p className="text-sm text-gray-600">
                {totalActive} active tasks • {data.health.stuckTasks} stuck • {data.health.recentErrorRate} error rate (1hr)
              </p>
            </div>
          </div>
          <button 
            onClick={fetchStatus}
            className="px-3 py-1 text-sm bg-white rounded border hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Tasks by Status</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(data.byStatus).map(([status, count]) => (
              <div 
                key={status}
                className={`p-4 rounded-lg text-center ${STATUS_COLORS[status] || 'bg-gray-100'}`}
              >
                <div className="text-3xl font-bold">{count}</div>
                <div className="text-sm capitalize">{status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Type Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Active Tasks by Type</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(data.byTaskType).map(([type, count]) => (
              <div 
                key={type}
                className={`p-4 rounded-lg text-center ${TASK_COLORS[type] || 'bg-gray-100'}`}
              >
                <div className="text-3xl font-bold">{count}</div>
                <div className="text-sm capitalize flex items-center justify-center gap-2">
                  <span>{type === 'text' ? '📝' : type === 'audio' ? '🔊' : '📄'}</span>
                  {type}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Last Hour Activity</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{data.health.recentTotal}</div>
            <div className="text-sm text-gray-500">Total Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{data.health.recentErrors}</div>
            <div className="text-sm text-gray-500">Errors</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${errorRateNum < 5 ? 'text-green-600' : errorRateNum < 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              {data.health.recentErrorRate}
            </div>
            <div className="text-sm text-gray-500">Error Rate</div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(data.timestamp).toLocaleString()}
        <span className="ml-2 text-xs">(auto-refreshes every 30s)</span>
      </div>
    </div>
  );
}
