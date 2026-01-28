'use client';

import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../../lib/api/client';

interface JobLog {
  job_id: string;
  job_type: string;
  job_status: string;
  job_created_at: string;
  job_completed_at: string | null;
  total_cost_usd: number;
  cost_breakdown: any;
  tasks: TaskLog[];
}

interface TaskLog {
  task_id: string;
  task_type: string;
  task_status: string;
  execution_time_ms: number;
  error_message: string | null;
  cost_data: any;
  created_at: string;
  completed_at: string | null;
}

export function JobLogsPanel() {
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'running'>('all');

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [filter]);

  const fetchLogs = async () => {
    try {
      setError(null);
      const result = await dashboardApi.getJobLogs(filter);
      setLogs(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatCost = (cost: number) => {
    if (!cost) return '$0.00';
    return `$${cost.toFixed(4)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'pending': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const calculateJobDuration = (job: JobLog) => {
    if (!job.job_completed_at) return null;
    const start = new Date(job.job_created_at).getTime();
    const end = new Date(job.job_completed_at).getTime();
    return end - start;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const selectedJobData = logs.find(j => j.job_id === selectedJob);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">📋 Job Execution Logs</h2>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'success', 'failed', 'running'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === f
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? '📊 All' : f === 'success' ? '✅ Success' : f === 'failed' ? '❌ Failed' : '⏳ Running'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Jobs List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tasks</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((job) => {
              const duration = calculateJobDuration(job);
              const taskStats = {
                total: job.tasks.length,
                complete: job.tasks.filter(t => t.task_status === 'complete').length,
                failed: job.tasks.filter(t => t.task_status === 'failed').length,
                processing: job.tasks.filter(t => t.task_status === 'processing').length,
              };

              return (
                <tr key={job.job_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {job.job_id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {job.job_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.job_status)}`}>
                      {job.job_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {duration ? formatDuration(duration) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCost(job.total_cost_usd)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex gap-2">
                      <span className="text-green-600">{taskStats.complete}✓</span>
                      {taskStats.failed > 0 && <span className="text-red-600">{taskStats.failed}✗</span>}
                      {taskStats.processing > 0 && <span className="text-blue-600">{taskStats.processing}⏳</span>}
                      <span className="text-gray-400">/ {taskStats.total}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.job_created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedJob(selectedJob === job.job_id ? null : job.job_id)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {selectedJob === job.job_id ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {logs.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            No jobs found
          </div>
        )}
      </div>

      {/* Job Details Modal */}
      {selectedJobData && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              📝 Job Details: {selectedJobData.job_id.slice(0, 8)}
            </h3>
            <button
              onClick={() => setSelectedJob(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Cost Breakdown */}
          {selectedJobData.cost_breakdown && Object.keys(selectedJobData.cost_breakdown).length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2">💰 Cost Breakdown</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(selectedJobData.cost_breakdown).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-xs text-gray-500 uppercase">{key}</div>
                    <div className="text-lg font-bold text-gray-900">{formatCost(value as number)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">🔧 Tasks ({selectedJobData.tasks.length})</h4>
            <div className="space-y-3">
              {selectedJobData.tasks.map((task) => (
                <div key={task.task_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-gray-900">{task.task_type}</span>
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.task_status)}`}>
                        {task.task_status}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">⏱️ {formatDuration(task.execution_time_ms)}</div>
                      {task.cost_data?.cost_usd && (
                        <div className="text-sm font-medium text-gray-900">{formatCost(task.cost_data.cost_usd)}</div>
                      )}
                    </div>
                  </div>

                  {/* Task Cost Details */}
                  {task.cost_data && (
                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      {task.cost_data.provider && (
                        <div>Provider: <span className="font-medium">{task.cost_data.provider}</span></div>
                      )}
                      {task.cost_data.model && (
                        <div>Model: <span className="font-medium">{task.cost_data.model}</span></div>
                      )}
                      {task.cost_data.input_tokens && (
                        <div>Tokens: <span className="font-medium">{task.cost_data.input_tokens} in / {task.cost_data.output_tokens} out</span></div>
                      )}
                    </div>
                  )}

                  {/* Error Message */}
                  {task.error_message && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                      <strong>Error:</strong> {task.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
