'use client';

import React, { useEffect, useState } from 'react';

interface BucketUsage {
  fileCount?: number;
  totalSizeMB?: string;
  recentFiles?: Array<{
    name: string;
    size: number;
    created: string;
  }>;
  error?: string;
}

interface StorageData {
  buckets: Record<string, BucketUsage>;
  timestamp: string;
}

const BUCKET_ICONS: Record<string, string> = {
  audio: '🔊',
  'pdf-readings': '📄',
  songs: '🎵',
};

const BUCKET_COLORS: Record<string, string> = {
  audio: 'bg-pink-50 border-pink-200',
  'pdf-readings': 'bg-orange-50 border-orange-200',
  songs: 'bg-purple-50 border-purple-200',
};

export function StorageUsagePanel() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/storage/usage', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch storage usage');
      
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg"></div>
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
          <h3 className="font-semibold">Error loading storage usage</h3>
          <p className="text-sm">{error}</p>
          <button onClick={fetchUsage} className="mt-2 text-sm text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalFiles = Object.values(data.buckets).reduce((sum, b) => sum + (b.fileCount || 0), 0);
  const totalSize = Object.values(data.buckets).reduce((sum, b) => sum + parseFloat(b.totalSizeMB || '0'), 0);

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">💾 Supabase Storage Usage</h2>
            <p className="text-sm text-gray-500">
              {totalFiles.toLocaleString()} files • {totalSize.toFixed(2)} MB total
            </p>
          </div>
          <button 
            onClick={fetchUsage}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(data.buckets).map(([bucket, usage]) => (
              <div 
                key={bucket}
                className={`p-4 rounded-lg border-2 ${BUCKET_COLORS[bucket] || 'bg-gray-50 border-gray-200'}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{BUCKET_ICONS[bucket] || '📁'}</span>
                  <h3 className="font-semibold text-gray-900">{bucket}</h3>
                </div>

                {usage.error ? (
                  <div className="text-red-600 text-sm">{usage.error}</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {usage.fileCount?.toLocaleString() || 0}
                        </div>
                        <div className="text-xs text-gray-500">Files</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {usage.totalSizeMB || '0'}
                        </div>
                        <div className="text-xs text-gray-500">MB</div>
                      </div>
                    </div>

                    {usage.recentFiles && usage.recentFiles.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">Recent Files:</div>
                        <div className="space-y-1">
                          {usage.recentFiles.slice(0, 3).map((file, i) => (
                            <div key={i} className="text-xs text-gray-500 truncate" title={file.name}>
                              {file.name} ({formatBytes(file.size)})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
