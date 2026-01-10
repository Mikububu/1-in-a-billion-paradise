/**
 * SAVED READING SCREEN
 *
 * Canonical viewer for a previously saved deep reading from `profileStore`.
 * This fixes the UX issue where the Library lists could not open a specific saved reading.
 */

import { useMemo } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography } from '@/theme/tokens';
import { useProfileStore } from '@/store/profileStore';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'SavedReading'>;

const SYSTEM_NAMES: Record<string, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic (Jyotish)',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
};

export const SavedReadingScreen = ({ navigation, route }: Props) => {
  const { personId, readingId } = route.params;
  const person = useProfileStore((s) => s.getPerson(personId));

  const reading = useMemo(() => {
    return person?.readings?.find((r) => r.id === readingId);
  }, [person, readingId]);

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleShare = async () => {
    if (!reading?.content) return;
    try {
      await Share.share({
        message: reading.content,
      });
    } catch {
      // ignored
    }
  };

  if (!person || !reading) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Reading not found</Text>
          <Text style={styles.emptySubtitle}>
            This saved reading is missing or was removed.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('MyLibrary')}
          >
            <Text style={styles.primaryButtonText}>Go to My Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Options', undefined, [
              { text: 'Share', onPress: handleShare },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <Text style={styles.actionText}>•••</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.systemLabel}>
          {SYSTEM_NAMES[reading.system] || reading.system}
        </Text>
        <Text style={styles.title} selectable>
          {person.name}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText} selectable>
            {formatTimestamp(reading.generatedAt)}
          </Text>
          <Text style={styles.metaText} selectable>
            {reading.wordCount} words · {reading.source}
          </Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.body} selectable>
          {reading.content}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  actionText: { fontFamily: typography.sansSemiBold, fontSize: 18, color: colors.primary },
  scrollView: { flex: 1 },
  content: { padding: spacing.page, paddingBottom: spacing.xl * 2 },
  systemLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  metaRow: { marginTop: spacing.md },
  metaText: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  body: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.text, lineHeight: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.page },
  emptyTitle: { fontFamily: typography.headline, fontSize: 22, color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, textAlign: 'center' },
  primaryButton: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: 999 },
  primaryButtonText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: '#FFFFFF' },
});






