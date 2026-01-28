'use client';

import React, { useEffect, useState } from 'react';
import { storageApi } from '../../lib/api/client';

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

const BUCKET_INFO: Record<string, { icon: string; description: string }> = {
  'audio': { icon: '🔊', description: 'Audio readings (MP3, M4A)' },
  'pdf-readings': { icon: '📄', description: 'PDF reading documents' },
  'songs': { icon: '🎵', description: 'Generated songs' },
};

export function StorageUsagePanel() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await storageApi.getUsage();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
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

  // Calculate totals
  const totalFiles = Object.values(data.buckets).reduce((sum, b) => sum + (b.fileCount || 0), 0);
  const totalSizeMB = Object.values(data.buckets).reduce((sum, b) => sum + parseFloat(b.totalSizeMB || '0'), 0);

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
          <div className="text-sm opacity-80">📁 Total Files</div>
          <div className="text-3xl font-bold">{totalFiles.toLocaleString()}</div>
          <div className="text-sm mt-2 opacity-80">across all buckets</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
          <div className="text-sm opacity-80">💾 Total Storage</div>
          <div className="text-3xl font-bold">{totalSizeMB.toFixed(2)} MB</div>
          <div className="text-sm mt-2 opacity-80">estimated usage</div>
        </div>
      </div>

      {/* Bucket Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(data.buckets).map(([bucket, usage]) => {
          const info = BUCKET_INFO[bucket] || { icon: '📦', description: bucket };
          const hasError = !!usage.error;
          
          return (
            <div 
              key={bucket}
              className={`bg-white rounded-lg shadow overflow-hidden ${hasError ? 'border-2 border-red-200' : ''}`}
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{info.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{bucket}</h3>
                    <p className="text-xs text-gray-500">{info.description}</p>
                  </div>
                </div>

                {hasError ? (
                  <div className="text-red-600 text-sm">{usage.error}</div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Files</span>
                      <span className="font-semibold">{usage.fileCount?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Size</span>
                      <span className="font-semibold">{usage.totalSizeMB || '0'} MB</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Files */}
              {usage.recentFiles && usage.recentFiles.length > 0 && (
                <div className="border-t">
                  <button
                    onClick={() => setExpandedBucket(expandedBucket === bucket ? null : bucket)}
                    className="w-full px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 flex justify-between items-center"
                  >
                    <span>Recent files</span>
                    <span>{expandedBucket === bucket ? '▲' : '▼'}</span>
                  </button>
                  
                  {expandedBucket === bucket && (
                    <div className="px-4 pb-4">
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {usage.recentFiles.map((file, i) => (
                          <div key={i} className="text-xs p-2 bg-gray-50 rounded">
                            <div className="font-medium truncate" title={file.name}>
                              {file.name}
                            </div>
                            <div className="text-gray-500 flex justify-between mt-1">
                              <span>{formatSize(file.size)}</span>
                              <span>{new Date(file.created).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Timestamp */}
      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>Last updated: {new Date(data.timestamp).toLocaleString()}</span>
        <button 
          onClick={fetchUsage}
          className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
        >
          Refresh
        </button>
      </div>

      {/* Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-amber-800">
            <strong>Note:</strong> File counts are limited to the most recent 1,000 files per bucket. 
            Total sizes are estimates based on available metadata. For accurate billing information, 
            check your Supabase dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}
