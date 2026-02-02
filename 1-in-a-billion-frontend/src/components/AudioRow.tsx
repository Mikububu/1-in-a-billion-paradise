import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { audioApi } from '@/services/api';
import { colors, spacing, typography, radii } from '@/theme/tokens';

type AudioStatus = 'locked' | 'processing' | 'ready';

type AudioRowProps = {
  audioId: string;
  status: AudioStatus;
  durationSeconds?: number;
  priceLabel?: string;
};

const formatDuration = (seconds?: number) => {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

export const AudioRow = ({ audioId, status, durationSeconds, priceLabel = '$5.00' }: AudioRowProps) => {
  const [localStatus, setLocalStatus] = useState<AudioStatus>(status);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleUnlock = async () => {
    setLocalStatus('processing');
    await audioApi.generate(audioId);
    setLocalStatus('ready');
  };

  if (localStatus === 'locked') {
    return (
      <View style={styles.row}>
        <View>
          <Text style={styles.rowTitle}>Audio narration</Text>
          <Text style={styles.rowHint}>Unlock once, reuse forever</Text>
        </View>
        <Pressable style={styles.unlockBtn} onPress={handleUnlock}>
          <Text style={styles.unlockText}>Unlock {priceLabel}</Text>
        </Pressable>
      </View>
    );
  }

  if (localStatus === 'processing') {
    return (
      <View style={styles.row}>
        <View>
          <Text style={styles.rowTitle}>Audio narration</Text>
          <Text style={styles.rowHint}>Generating…</Text>
        </View>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.readyRow}>
      <Pressable
        onPress={() => setIsPlaying((prev) => !prev)}
        style={[styles.playButton, isPlaying ? styles.playButtonActive : null]}
      >
        <Text style={styles.playButtonLabel}>{isPlaying ? 'Pause' : 'Play'}</Text>
      </Pressable>
      <View style={styles.scrubber}>
        <View style={[styles.scrubberFill, { width: isPlaying ? '70%' : '0%' }]} />
      </View>
      <Text style={styles.duration}>{formatDuration(durationSeconds)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardStroke,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  rowTitle: {
    fontFamily: typography.sansSemiBold,
    color: colors.text,
  },
  rowHint: {
    fontFamily: typography.sansRegular,
    color: colors.mutedText,
    fontSize: 13,
    marginTop: 2,
  },
  unlockBtn: {
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  unlockText: {
    fontFamily: typography.sansSemiBold,
    color: colors.primary,
    fontSize: 13,
  },
  readyRow: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardStroke,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playButton: {
    borderRadius: radii.button,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  playButtonActive: {
    backgroundColor: colors.primary,
  },
  playButtonLabel: {
    fontFamily: typography.sansSemiBold,
    color: colors.text,
  },
  scrubber: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  duration: {
    fontFamily: typography.sansMedium,
    color: colors.mutedText,
  },
});

