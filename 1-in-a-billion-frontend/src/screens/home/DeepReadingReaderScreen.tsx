/**
 * DEEP READING READER (extended jobs)
 *
 * Text-first reader UI for a completed deep reading job.
 * Uses artifacts (text/audio/pdf) when available, and keeps status visible.
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
import { splitIntoBlocks } from '@/utils/readingTextFormat';
import { env } from '@/config/env';

type Props = NativeStackScreenProps<MainStackParamList, 'DeepReadingReader'>;

export const DeepReadingReaderScreen = ({ navigation, route }: Props) => {
  const { jobId } = route.params;
  const [job, setJob] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [text, setText] = useState<string | null>(null);
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
      const arts = (a || []) as any[];
      setArtifacts(arts);

      // Prefer first text artifact
      if (!text) {
        const textArt = arts.find((x) => x.artifact_type === 'text' && x.storage_path);
        if (textArt?.storage_path) {
          const body = await downloadTextContent(textArt.storage_path);
          if (body) setText(body);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  }, [jobId, text]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 15000);
      return () => clearInterval(t);
    }, [load])
  );

  const title = useMemo(() => {
    const p = job?.input?.person?.name || job?.input?.person1?.name || 'Person';
    return `Deep Reading · ${p}`;
  }, [job]);

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

  const getFirst = (type: string) => artifacts.find((a) => a.artifact_type === type && a.storage_path);

  const canRetry = useMemo(() => job?.status === 'error' && job?.input, [job?.input, job?.status]);
  const retry = useCallback(() => {
    if (!job?.input || !job?.type) return;
    Alert.alert(
      'Retry this reading?',
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
              navigation.replace('DeepReadingReader', { jobId: newJobId });
            } catch (e: any) {
              Alert.alert('Retry failed', e?.message || 'Unknown error');
            }
          },
        },
      ]
    );
  }, [job?.input, job?.type, navigation]);

  const blocks = useMemo(() => splitIntoBlocks(text || ''), [text]);

  const openPdf = useCallback(async () => {
    const pdf = getFirst('pdf');
    if (!pdf) return Alert.alert('PDF not ready', 'No PDF artifact is available yet.');
    const url = await createArtifactSignedUrl(pdf.storage_path, 60 * 60);
    if (!url) return Alert.alert('PDF not ready', 'Could not fetch PDF URL yet.');
    Linking.openURL(url).catch(() => Alert.alert('Could not open PDF'));
  }, [artifacts]);

  const playAudio = useCallback(async () => {
    const audio = getFirst('audio');
    if (!audio) return Alert.alert('Audio not ready', 'No audio artifact is available yet.');
    const url = await createArtifactSignedUrl(audio.storage_path, 60 * 60);
    if (!url) return Alert.alert('Audio not ready', 'Could not fetch audio URL yet.');
    navigation.navigate('AudioPlayer', { title, audioUrl: url, readingId: jobId });
  }, [artifacts, jobId, navigation, title]);

  const playSong = useCallback(async () => {
    const song = getFirst('audio_song');
    if (!song) return Alert.alert('Song not ready', 'No song artifact is available yet.');
    const url = await createArtifactSignedUrl(song.storage_path, 60 * 60);
    if (!url) return Alert.alert('Song not ready', 'Could not fetch song URL yet.');
    navigation.navigate('AudioPlayer', { 
      title: song.metadata?.title || 'Your Song', 
      audioUrl: url, 
      readingId: jobId 
    });
  }, [artifacts, jobId, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Reading</Text>
        <TouchableOpacity onPress={load} disabled={isRefreshing} style={styles.refreshBtn}>
          <Text style={[styles.refreshText, isRefreshing && { opacity: 0.5 }]}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} selectable>{title}</Text>
        {!!statusLine && <Text style={styles.status} selectable>{statusLine}</Text>}

        {canRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={playAudio}>
            <Text style={styles.actionText}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={openPdf}>
            <Text style={styles.actionText}>PDF</Text>
          </TouchableOpacity>
          {getFirst('audio_song') && (
            <TouchableOpacity style={styles.actionBtn} onPress={playSong}>
              <Text style={styles.actionText}>🎵 Song</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.textCard}>
          {blocks.length === 0 ? (
            <Text style={styles.textBody} selectable>{text || 'Text not ready yet.'}</Text>
          ) : (
            blocks.map((b, idx) =>
              b.kind === 'heading' ? (
                <Text key={idx} style={styles.heading} selectable>{b.text}</Text>
              ) : (
                <Text key={idx} style={styles.textBody} selectable>{b.text}</Text>
              )
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  headerTitle: { fontFamily: typography.headline, fontSize: 20, color: colors.text },
  refreshBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  refreshText: { fontFamily: typography.sansSemiBold, fontSize: 18, color: colors.primary },
  scrollView: { flex: 1 },
  content: { padding: spacing.page, paddingBottom: spacing.xl * 2 },
  title: { fontFamily: typography.headline, fontSize: 32, color: colors.text },
  status: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText, marginTop: spacing.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: spacing.sm, alignItems: 'center' },
  actionText: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text },
  textCard: { marginTop: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.card, padding: spacing.lg },
  textBody: { fontFamily: typography.sansRegular, fontSize: 15, color: colors.text, lineHeight: 22 },
  heading: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  retryBtn: { marginTop: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  retryText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.primary },
});


