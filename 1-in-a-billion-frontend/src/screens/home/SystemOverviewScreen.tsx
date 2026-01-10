/**
 * SYSTEM OVERVIEW SCREEN
 * 
 * Shows Sun/Moon/Rising readings for a specific system in a swipeable format.
 * This is the "overview" level - free hook content showing the 3 core placements.
 */

import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'SystemOverview'>;

const { width: PAGE_WIDTH } = Dimensions.get('window');

type ReadingType = 'sun' | 'moon' | 'rising';

const READING_LABELS: Record<ReadingType, string> = {
  sun: 'Sun Sign',
  moon: 'Moon Sign',
  rising: 'Rising Sign',
};

const READING_ICONS: Record<ReadingType, string> = {
  sun: '☉',
  moon: '☽',
  rising: '↑',
};

export const SystemOverviewScreen = ({ navigation, route }: Props) => {
  const { personId, system } = route.params || {};

  const hookReadings = useOnboardingStore((s) => s.hookReadings);
  const person = useProfileStore((s) => s.getPerson(personId));
  const user = useProfileStore((s) => s.getUser());

  const [page, setPage] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState<Record<string, boolean>>({});
  const soundRef = useRef<Audio.Sound | null>(null);
  const listRef = useRef<FlatList<ReadingType>>(null);

  const isUser = personId === user?.id || !personId;
  const readings = isUser ? hookReadings : null; // For now, only show for current user

  const pages: ReadingType[] = ['sun', 'moon', 'rising'];

  const handleNext = () => {
    if (page < pages.length - 1) {
      listRef.current?.scrollToIndex({ index: page + 1, animated: true });
    } else {
      navigation.goBack();
    }
  };

  const handleAudioToggle = async (type: ReadingType) => {
    // TODO: Implement audio playback
    console.log('Play audio for', type);
  };

  const renderPage = ({ item: type }: { item: ReadingType }) => {
    const reading = readings?.[type];

    if (!reading) {
      return (
        <View style={[styles.page, { width: PAGE_WIDTH }]}>
          <Text style={styles.emptyText}>No {READING_LABELS[type]} reading available</Text>
        </View>
      );
    }

    return (
      <View style={[styles.page, { width: PAGE_WIDTH }]}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>{READING_LABELS[type]}</Text>
          <Text style={styles.icon}>{READING_ICONS[type]}</Text>
          <Text style={styles.sign}>{reading.sign}</Text>

          {/* Audio Button */}
          <TouchableOpacity
            style={styles.audioButton}
            onPress={() => handleAudioToggle(type)}
          >
            <Text style={styles.audioButtonText}>
              {audioPlaying[type] ? '■ Stop' : '▶ Listen'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.intro} selectable>{reading.intro}</Text>
          <Text style={styles.main} selectable>{reading.main}</Text>
        </ScrollView>

        {/* Next Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {page < pages.length - 1 ? `Next: ${READING_LABELS[pages[page + 1]]}` : 'Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{system?.toUpperCase()} OVERVIEW</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Swipeable Pages */}
      <FlatList
        ref={listRef}
        data={pages}
        renderItem={renderPage}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const newPage = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
          setPage(newPage);
        }}
      />

      {/* Page Indicator */}
      <View style={styles.indicator}>
        {pages.map((_, idx) => (
          <View
            key={idx}
            style={[styles.dot, idx === page && styles.dotActive]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

const { ScrollView } = require('react-native');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backText: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.primary,
  },
  headerTitle: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 1,
  },
  page: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.page,
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  sign: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  audioButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 24,
    marginBottom: spacing.lg,
  },
  audioButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  intro: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: spacing.lg,
    textAlign: 'left',
    width: '100%',
  },
  main: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    textAlign: 'left',
    width: '100%',
  },
  footer: {
    padding: spacing.page,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  nextButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.button,
    alignItems: 'center',
  },
  nextButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  indicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  emptyText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xl * 2,
  },
});





