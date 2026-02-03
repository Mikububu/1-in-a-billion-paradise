/**
 * PERSON JOBS LIST SCREEN
 * 
 * Shows ALL jobs for a specific person.
 * Groups by system and numbers duplicates (e.g., "Vedic - 2nd Reading").
 * Only shows generating jobs (hides completed ones or marks them clearly).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { colors } from '@/theme/tokens';
import { useAuthStore } from '@/store/authStore';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'PersonJobsList'>;

type Job = {
  id: string;
  status: string;
  type: string;
  createdAt: string;
  percent?: number;
  tasksComplete?: number;
  tasksTotal?: number;
  systems?: string[]; // Which systems are included
};

const SYSTEM_NAMES: Record<string, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic (Jyotish)',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
};

export const PersonJobsListScreen = ({ navigation, route }: Props) => {
  const { personName, personId } = route.params || {};
  const userId = useAuthStore((s) => s.user?.id);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!userId) {
      setError('No user ID found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${env.CORE_API_URL}/api/jobs/v2/user/${userId}/jobs`);
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs (${response.status})`);
      }

      const data = await response.json();
      console.log('📦 Fetched jobs for user:', data);

      // Filter and sort jobs
      const allJobs = (data.jobs || []) as Job[];
      
      // Sort by creation date (newest first)
      allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setJobs(allJobs);
    } catch (err: any) {
      console.error('Failed to load jobs:', err);
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Group jobs by system and count duplicates
  const groupedJobs = React.useMemo(() => {
    const groups: Record<string, Job[]> = {};

    jobs.forEach((job) => {
      // For nuclear_v2 and extended jobs, extract systems
      const systems = job.systems || ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];

      systems.forEach((system) => {
        if (!groups[system]) {
          groups[system] = [];
        }
        groups[system].push(job);
      });
    });

    return groups;
  }, [jobs]);

  const renderJobItem = (job: Job, systemKey: string, index: number) => {
    const systemName = SYSTEM_NAMES[systemKey] || systemKey;
    const isGenerating = job.status === 'processing' || job.status === 'pending';
    const isComplete = job.status === 'completed';

    // Number duplicates: "Vedic - 2nd Reading", "Vedic - 3rd Reading"
    const readingNumber = index + 1;
    const readingLabel = index === 0 ? systemName : `${systemName} - ${readingNumber}${readingNumber === 2 ? 'nd' : readingNumber === 3 ? 'rd' : 'th'} Reading`;

    return (
      <TouchableOpacity
        key={`${job.id}-${systemKey}`}
        style={[
          styles.jobCard,
          isGenerating && styles.jobCardGenerating,
          isComplete && styles.jobCardComplete,
        ]}
        onPress={() => {
          // Navigate to PersonReadingsScreen for this specific job
          navigation.navigate('PersonReadings', {
            personName: personName || 'Unknown',
            personType: 'individual',
            jobId: job.id,
          });
        }}
      >
        <Text style={styles.jobTitle}>{readingLabel}</Text>
        
        {isGenerating && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#FF6B6B" />
            <Text style={styles.statusText}>
              Generating... {job.percent ? `${Math.round(job.percent)}%` : ''}
            </Text>
          </View>
        )}

        {isComplete && (
          <Text style={styles.statusComplete}>✅ Ready</Text>
        )}

        {job.status === 'failed' && (
          <Text style={styles.statusFailed}>❌ Failed</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#C41E3A" />
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadJobs} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{personName || 'Readings'}</Text>

        {jobs.length === 0 ? (
          <Text style={styles.emptyText}>No readings found for this person.</Text>
        ) : (
          <>
            {Object.entries(groupedJobs).map(([systemKey, systemJobs]) => (
              <View key={systemKey} style={styles.systemGroup}>
                {systemJobs.map((job, index) => renderJobItem(job, systemKey, index))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backText: {
    fontSize: 16,
    color: '#C41E3A',
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 24,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#C41E3A',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#C41E3A',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
  },
  systemGroup: {
    marginBottom: 16,
  },
  jobCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  jobCardGenerating: {
    borderColor: '#FFD700',
    backgroundColor: '#FFFEF5',
  },
  jobCardComplete: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8F4',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#856404',
  },
  statusComplete: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  statusFailed: {
    fontSize: 13,
    color: '#C41E3A',
    fontWeight: '600',
  },
});
