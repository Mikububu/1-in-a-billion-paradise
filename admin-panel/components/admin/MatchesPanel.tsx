'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  person1_name: string;
  person2_name: string;
  compatibility_score: number | null;
  match_reason: string | null;
  systems_matched: string[];
  status: string;
  created_at: string;
}

interface GalleryStats {
  total_portraits: number;
  active_users: number;
  recent_uploads: number;
}

interface MatchStats {
  total_matches: number;
  active_matches: number;
  pending_matches: number;
  declined_matches: number;
  avg_compatibility: number;
}

export function MatchesPanel() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [galleryStats, setGalleryStats] = useState<GalleryStats | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchesRes, statsRes] = await Promise.all([
          apiClient.matchesApi.getAll(),
          apiClient.matchesApi.getStats(),
        ]);

        setMatches(matchesRes.matches || []);
        setMatchStats(statsRes.matchStats || null);
        setGalleryStats(statsRes.galleryStats || null);
      } catch (error) {
        console.error('Failed to fetch matches data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'declined':
        return 'bg-red-500/20 text-red-400';
      case 'blocked':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-blue-500/20 text-blue-400';
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-white">Matches & Gallery</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Gallery Stats */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-3xl font-bold text-purple-400">
            {galleryStats?.total_portraits || 0}
          </div>
          <div className="text-sm text-gray-400">Claymation Portraits</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-3xl font-bold text-blue-400">
            {galleryStats?.active_users || 0}
          </div>
          <div className="text-sm text-gray-400">Active Users</div>
        </div>

        {/* Match Stats */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-3xl font-bold text-green-400">
            {matchStats?.total_matches || 0}
          </div>
          <div className="text-sm text-gray-400">Total Matches</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-3xl font-bold text-yellow-400">
            {matchStats?.avg_compatibility ? `${Math.round(matchStats.avg_compatibility)}%` : 'N/A'}
          </div>
          <div className="text-sm text-gray-400">Avg Compatibility</div>
        </div>
      </div>

      {/* Match Status Breakdown */}
      {matchStats && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">Match Status Distribution</h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-300">Active: {matchStats.active_matches}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-gray-300">Pending: {matchStats.pending_matches}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm text-gray-300">Declined: {matchStats.declined_matches}</span>
            </div>
          </div>
        </div>
      )}

      {/* Matches Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Recent Matches</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Users</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Systems</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {matches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No matches yet
                  </td>
                </tr>
              ) : (
                matches.slice(0, 20).map((match) => (
                  <tr key={match.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white">{match.person1_name || 'User 1'}</span>
                        <span className="text-gray-500">×</span>
                        <span className="text-white">{match.person2_name || 'User 2'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {match.compatibility_score ? (
                        <span className="text-purple-400 font-medium">
                          {Math.round(match.compatibility_score)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {(match.systems_matched || []).slice(0, 3).map((sys) => (
                          <span
                            key={sys}
                            className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400"
                          >
                            {sys}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${statusColor(match.status)}`}>
                        {match.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(match.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-2">💡 How Matching Works</h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Background algorithms compare users through Vedic astrology</li>
          <li>• Matches are created when compatibility exceeds threshold</li>
          <li>• Both users receive a system-generated welcome message</li>
          <li>• Users only see each other's claymation portraits (privacy preserved)</li>
        </ul>
      </div>
    </div>
  );
}

export default MatchesPanel;
