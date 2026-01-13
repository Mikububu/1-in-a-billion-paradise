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
  personId?: string;
  jobId: string;
  systemId: string;
  systemName: string;
  docNum: number;
  timestamp?: string;
  nextChapter?: any;
};

export const PersonReadingChaptersFlowScreen = ({ navigation, route }: Props) => {
  const { personName, personType, jobId, personId } = route.params;
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

        // Build chapters for ALL systems requested in job.params.systems
        // This ensures navigation shows all expected systems even if some documents aren't ready yet
        // Documents that aren't ready will show gray/empty content (handled by ReadingChapterScreen)
        const requestedSystems: string[] = (job?.params?.systems || []).map((s: string) => s.toLowerCase());
        
        // Use requested systems from job params, falling back to SYSTEMS constant
        let orderedSystems = (effectiveViewType === 'overlay' ? SYSTEMS : SYSTEMS.filter((s) => s.id !== 'verdict'));
        
        // If job has specific systems requested, filter to only those (in the correct order)
        if (requestedSystems.length > 0) {
          orderedSystems = requestedSystems
            .map(sysId => SYSTEMS.find(s => s.id.toLowerCase() === sysId))
            .filter(Boolean) as typeof SYSTEMS;
          
          // For overlays, add verdict at the end if not already included
          if (effectiveViewType === 'overlay') {
            const verdictSystem = SYSTEMS.find(s => s.id === 'verdict');
            if (verdictSystem && !orderedSystems.includes(verdictSystem)) {
              orderedSystems.push(verdictSystem);
            }
          }
        }
        
        console.log(`📚 Building ${orderedSystems.length} chapters for job ${jobId} (${orderedSystems.map(s => s.id).join(', ')})`);
        console.log(`📚 Documents ready: ${chapterDocs.length} (${chapterDocs.map(d => d.system).join(', ')})`);
        
        // Systems with actual documents (for reference, not for filtering)
        const systemsInJob = new Set(chapterDocs.map((d) => String(d?.system || '').toLowerCase()));

        const built: Chapter[] = orderedSystems.map((sys, index) => {
          const match = chapterDocs.find((d) => String(d?.system || '').toLowerCase() === sys.id.toLowerCase());
          
          // Use docNum from document if available, otherwise use sequential index
          // If document isn't ready yet, the screen will show empty/gray content (which is fine)
          const docNum = match ? Number(match?.docNum) || (index + 1) : (index + 1);
          
          return {
            personName,
            personId,
            jobId,
            systemId: sys.id,
            systemName: sys.name,
            docNum,
            timestamp: createdAt,
          };
        });

        if (!mounted) return;
        // Build nextChapter chain from END to START so each nextChapter has its own nextChapter set
        let withNext: Chapter[] = [];
        for (let i = built.length - 1; i >= 0; i--) {
          withNext.unshift({
            ...built[i],
            nextChapter: withNext[0] || undefined, // Points to already-enhanced next chapter
          });
        }
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

