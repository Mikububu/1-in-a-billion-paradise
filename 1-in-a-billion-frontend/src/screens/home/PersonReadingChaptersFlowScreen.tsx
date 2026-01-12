import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'PersonReadings'>;

const SYSTEMS = [
  { id: 'western', name: 'Western Astrology' },
  { id: 'vedic', name: 'Vedic (Jyotish)' },
  { id: 'human_design', name: 'Human Design' },
  { id: 'gene_keys', name: 'Gene Keys' },
  { id: 'kabbalah', name: 'Kabbalah' },
  { id: 'verdict', name: 'Final Verdict' },
] as const;

type Chapter = {
  personName: string;
  jobId: string;
  systemId: string;
  systemName: string;
  docNum: number;
  timestamp?: string;
  nextChapter?: any;
};

export const PersonReadingChaptersFlowScreen = ({ navigation, route }: Props) => {
  const { personName, personType, jobId } = route.params;
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!jobId) throw new Error('Missing jobId');
        setLoading(true);
        const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/${jobId}`);
        if (!res.ok) throw new Error(`Failed to load job (${res.status})`);
        const payload = await res.json();
        const job = payload?.job;
        const docs: any[] = Array.isArray(job?.results?.documents) ? job.results.documents : [];
        const createdAt = job?.created_at || new Date().toISOString();
        const jt = String(job?.type || '');

        const effectiveViewType: 'individual' | 'person1' | 'person2' | 'overlay' =
          personType === 'overlay' ? 'overlay' : personType === 'individual' ? 'individual' : (personType as any);

        const desiredDocTypes =
          jt === 'nuclear_v2'
            ? effectiveViewType === 'overlay'
              ? ['overlay', 'verdict']
              : effectiveViewType === 'person2'
                ? ['person2']
                : ['person1']
            : null;

        const chapterDocs = docs.filter((d) => {
          const docNum = Number(d?.docNum);
          if (!docNum) return false;
          if (jt !== 'nuclear_v2') return true;
          const docType = String(d?.docType || d?.doc_type || '');
          if (!docType) return false;
          return (desiredDocTypes || []).includes(docType);
        });

        // Build exactly 5 or 6, in fixed order.
        const orderedSystems = effectiveViewType === 'overlay'
          ? SYSTEMS
          : SYSTEMS.filter((s) => s.id !== 'verdict');

        const built: Chapter[] = orderedSystems.map((sys) => {
          const match = chapterDocs.find((d) => String(d?.system || '') === sys.id) || null;
          const docNum = Number(match?.docNum) || 0;
          return {
            personName,
            jobId,
            systemId: sys.id,
            systemName: sys.name,
            docNum,
            timestamp: createdAt,
          };
        }).filter((c) => c.docNum > 0);

        if (!mounted) return;
        // Attach next pointers for navigation
        const withNext = built.map((c, idx) => ({
          ...c,
          nextChapter: idx < built.length - 1 ? built[idx + 1] : undefined,
        }));
        setChapters(withNext);

        // Auto-enter the first chapter (so user never sees an intermediate list)
        if (withNext.length > 0) {
          navigation.replace('ReadingChapter', withNext[0] as any);
        }
      } catch (e: any) {
        if (!mounted) return;
        Alert.alert('Reading', e?.message || 'Could not open reading');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [jobId, personName, personType, navigation]);

  // Fallback UI if auto-enter fails (should be rare)
  const first = useMemo(() => chapters[0], [chapters]);

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <View style={styles.center}>
        {loading ? (
          <ActivityIndicator />
        ) : first ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.replace('ReadingChapter', first as any)}
          >
            <Text style={styles.buttonText}>Open</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.text}>No readings found.</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontFamily: 'System', color: '#111827' },
  button: { backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  buttonText: { color: '#fff', fontFamily: 'System', fontWeight: '700' },
});

