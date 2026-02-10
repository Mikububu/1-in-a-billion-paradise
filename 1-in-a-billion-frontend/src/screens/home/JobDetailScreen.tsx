/**
 * JOB DETAIL SCREEN (Supabase queue)
 *
 * Generic detail view for non-nuclear jobs (extended / synastry).
 * Shows status, progress, and whatever artifacts are available (text/audio/pdf).
 */

import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, radii } from '@/theme/tokens';

import { MainStackParamList } from '@/navigation/RootNavigator';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { createArtifactSignedUrl, downloadTextContent } from '@/services/nuclearReadingsService';
import { getPlayableArtifactUrl } from '@/services/artifactCacheService';
import { env } from '@/config/env';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'JobDetail'>;

type ArtifactRow = {
  id: string;
  artifact_type: 'text' | 'audio' | 'pdf' | string;
  storage_path: string;
  metadata?: any;
  created_at: string;
};

export const JobDetailScreen = ({ navigation, route }: Props) => {
  const { jobId } = route.params;
  const [job, setJob] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [textsByPath, setTextsByPath] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setIsRefreshing(true);
    try {
      const { data: j } = await supabase
        .from('jobs')
        .select('id,type,status,progress,input,created_at,updated_at,results,error')
        .eq('id', jobId)
        .single();
      setJob(j || null);

      const { data: a } = await supabase
        .from('job_artifacts')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      setArtifacts((a || []) as any);
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 15000);
      return () => clearInterval(t);
    }, [load])
  );

  const title = useMemo(() => {
    const t = job?.type || 'Job';
    if (t === 'synastry') {
      const p1 = job?.input?.person1?.name || 'Person 1';
      const p2 = job?.input?.person2?.name || 'Person 2';
      return `Compatibility Overlay · ${p1} + ${p2}`;
    }
    if (t === 'extended') {
      const p = job?.input?.person?.name || job?.input?.person1?.name || 'Person';
      return `Deep Reading · ${p}`;
    }
    return String(t);
  }, [job]);

  const canOpenReader = useMemo(() => {
    const t = job?.type;
    if (t !== 'extended' && t !== 'synastry') return false;
    // Reader is meaningful once there's at least text or pdf/audio.
    return artifacts.some(
      (a) =>
        (a.artifact_type === 'text' ||
          a.artifact_type === 'pdf' ||
          a.artifact_type === 'audio' ||
          String(a.artifact_type || '').startsWith('audio_')) &&
        a.storage_path
    );
  }, [artifacts, job?.type]);

  const statusLine = useMemo(() => {
    const s = job?.status;
    const total = job?.progress?.totalTasks;
    const done = job?.progress?.completedTasks;
    const pct = job?.progress?.percent;
    const msg = job?.progress?.message || job?.error;
    const parts: string[] = [];
    if (typeof s === 'string') parts.push(s.toUpperCase());
    if (typeof total === 'number' && total > 0) parts.push(`${typeof done === 'number' ? done : 0}/${total}`);
    else if (typeof pct === 'number') parts.push(`${Math.round(pct)}%`);
    if (typeof msg === 'string' && msg.trim()) parts.push(msg.trim());
    return parts.join(' · ');
  }, [job]);

  const getFirstArtifact = (type: string) =>
    artifacts.find((a) => (a.artifact_type === type || (type === 'audio' && String(a.artifact_type || '').startsWith('audio_'))) && a.storage_path);

  const canRetry = useMemo(() => job?.status === 'error' && job?.input, [job?.input, job?.status]);

  const retry = useCallback(async () => {
    if (!job?.input || !job?.type) return;
    Alert.alert(
      'Retry this job?',
      'This will start a new job with the same inputs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry',
          style: 'destructive',
          onPress: async () => {
            try {
              const payload: any = {
                type: job.type,
                systems: job.input?.systems,
                person1: job.input?.person1 || job.input?.person,
                person2: job.input?.person2,
                relationshipIntensity: job.input?.relationshipIntensity ?? 5,
              };
              const r = await fetch(`${env.CORE_API_URL}/api/jobs/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (!r.ok) throw new Error(`Retry failed: ${r.status}`);
              const { jobId: newJobId } = await r.json();
              navigation.replace('JobDetail', { jobId: newJobId });
            } catch (e: any) {
              Alert.alert('Retry failed', e?.message || 'Unknown error');
            }
          },
        },
      ]
    );
  }, [job?.input, job?.type, navigation]);

  const openPdf = useCallback(async () => {
    const pdf = getFirstArtifact('pdf');
    if (!pdf) {
      Alert.alert('PDF not ready', 'No PDF artifact is available yet.');
      return;
    }
    const url = await createArtifactSignedUrl(pdf.storage_path, 60 * 60);
    if (!url) {
      Alert.alert('PDF not ready', 'Could not fetch PDF URL yet.');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Could not open PDF'));
  }, [artifacts]);

  const playAudio = useCallback(
    async () => {
      const audio = getFirstArtifact('audio');
      if (!audio) {
        Alert.alert('Audio not ready', 'No audio artifact is available yet.');
        return;
      }
      const docNum = (audio.metadata as any)?.docNum || 1;
      const url = await getPlayableArtifactUrl(jobId, docNum, 'audio', audio.storage_path);
      if (!url) {
        Alert.alert('Audio not ready', 'Could not fetch audio URL yet.');
        return;
      }
      navigation.navigate('AudioPlayer', { title, audioUrl: url, readingId: jobId });
    },
    [artifacts, jobId, navigation, title]
  );

  const readText = useCallback(async () => {
    const text = getFirstArtifact('text');
    if (!text) {
      Alert.alert('Text not ready', 'No text artifact is available yet.');
      return;
    }
    if (!textsByPath[text.storage_path]) {
      const body = await downloadTextContent(text.storage_path);
      if (body) setTextsByPath((prev) => ({ ...prev, [text.storage_path]: body }));
    }
  }, [artifacts, textsByPath]);

  const textBody = useMemo(() => {
    const text = getFirstArtifact('text');
    if (!text) return null;
    return textsByPath[text.storage_path] || null;
  }, [artifacts, textsByPath]);

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>Activity</Text>
        <TouchableOpacity onPress={load} disabled={isRefreshing} style={styles.refreshBtn}>
          <Text style={[styles.refreshText, isRefreshing && { opacity: 0.5 }]}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} selectable>{title}</Text>
        <Text style={styles.jobIdText} selectable>jobId: {jobId}</Text>
        {!!statusLine && <Text style={styles.status} selectable>{statusLine}</Text>}

        {canRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}

        {canOpenReader && (
          <TouchableOpacity
            style={styles.openReaderBtn}
            onPress={() => {
              if (job?.type === 'synastry') {
                navigation.navigate('OverlayReader', { jobId });
                return;
              }
              if (job?.type === 'extended') {
                navigation.navigate('DeepReadingReader', { jobId });
              }
            }}
          >
            <Text style={styles.openReaderText}>Open Reading</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={readText}>
            <Text style={styles.actionText}>Read</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={playAudio}>
            <Text style={styles.actionText}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={openPdf}>
            <Text style={styles.actionText}>PDF</Text>
          </TouchableOpacity>
        </View>

        {!!textBody && (
          <View style={styles.textCard}>
            <Text style={styles.textBody} selectable>{textBody}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Artifacts</Text>
        <View style={styles.card}>
          {artifacts.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>
                {isSupabaseConfigured ? 'No artifacts yet. They will appear as the job progresses.' : 'Supabase is not configured.'}
              </Text>
            </View>
          ) : (
            artifacts.slice(0, 20).map((a) => (
              <View key={a.id} style={styles.artifactRow}>
                <Text style={styles.artifactType}>{String(a.artifact_type).toUpperCase()}</Text>
                <Text style={styles.artifactPath} numberOfLines={1}>{a.storage_path}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: typography.headline, fontSize: 20, color: colors.text },
  refreshBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  refreshText: { fontFamily: typography.sansSemiBold, fontSize: 18, color: colors.primary },
  scrollView: { flex: 1 },
  content: { padding: spacing.page, paddingBottom: spacing.xl * 2 },
  title: { fontFamily: typography.headline, fontSize: 32, color: colors.text },
  jobIdText: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText, marginTop: 4 },
  status: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText, marginTop: spacing.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: spacing.sm, alignItems: 'center' },
  actionText: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text },
  openReaderBtn: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  openReaderText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: '#FFFFFF' },
  retryBtn: { marginTop: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  retryText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.primary },
  textCard: { marginTop: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.card, padding: spacing.lg },
  textBody: { fontFamily: typography.sansRegular, fontSize: 15, color: colors.text, lineHeight: 22 },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm, fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.mutedText, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  emptyRow: { padding: spacing.lg },
  emptyText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText },
  artifactRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  artifactType: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.text },
  artifactPath: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText, marginTop: 2 },
});


