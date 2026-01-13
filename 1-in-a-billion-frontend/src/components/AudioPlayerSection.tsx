import React from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useTextAutoScroll } from '../hooks/useTextAutoScroll';
import { colors, typography, radii } from '@/theme/tokens';

interface AudioPlayerSectionProps {
  audioUrl: string;
  text: string;
  loadingText: boolean;
  type: 'narration' | 'song';
  controlsDisabled?: boolean;
  textNotReady?: boolean; // True when text exists but audio/PDF aren't ready yet
}

export const AudioPlayerSection: React.FC<AudioPlayerSectionProps> = ({
  audioUrl,
  text,
  loadingText,
  type,
  controlsDisabled = false,
  textNotReady = false,
}) => {
  const audio = useAudioPlayer({ audioUrl });
  const textScroll = useTextAutoScroll({
    playing: audio.playing,
    seeking: audio.seeking,
    pos: audio.pos,
    dur: audio.dur,
  });

  const isNarration = type === 'narration';
  const primaryColor = isNarration ? colors.primary : '#B8860B'; // Dark goldenrod
  
  // Disable controls if audio not available yet (null = checking, false = not ready)
  const isDisabled = controlsDisabled || audio.available !== true;
  
  // Same icons but greyed out when disabled
  const icon = isNarration ? (audio.playing ? '❚❚' : '▶') : '♪';

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <>
      <View style={styles.mediaBlock}>
        <TouchableOpacity
          style={[
            styles.playButton,
            { borderColor: isDisabled ? '#999' : primaryColor, backgroundColor: isDisabled ? '#f5f5f5' : primaryColor + '20' },
            audio.playing && { backgroundColor: primaryColor + '30' },
          ]}
          onPress={audio.togglePlayback}
          disabled={isDisabled}
        >
          {audio.loading || audio.buffering ? (
            <ActivityIndicator color={isDisabled ? '#999' : primaryColor} />
          ) : (
            <Text style={[styles.playIcon, { color: isDisabled ? '#999' : primaryColor }]}>{icon}</Text>
          )}
        </TouchableOpacity>

        <View style={[styles.sliderOuter, isDisabled && { opacity: 0.5 }]}>
          <View
            pointerEvents="none"
            style={[
              styles.sliderPill,
              {
                borderColor: isDisabled ? '#999' : primaryColor,
                backgroundColor: isDisabled ? '#f0f0f0' : primaryColor + '15',
              },
            ]}
          />
          <View pointerEvents="none" style={styles.sliderDurationOverlay}>
            <Text style={[styles.sliderDurationText, isDisabled && { color: '#999' }]}>
              {audio.playing || audio.seeking ? fmt(audio.pos) : (audio.dur ? fmt(audio.dur) : '--:--')}
            </Text>
          </View>
          <Slider
            style={styles.sliderAbsolute}
            value={audio.dur > 0 ? Math.min(audio.pos, audio.dur) : 0}
            minimumValue={0}
            maximumValue={audio.dur || 1}
            minimumTrackTintColor={isDisabled ? '#999' : primaryColor}
            maximumTrackTintColor="transparent"
            thumbTintColor={isDisabled ? '#999' : primaryColor}
            thumbStyle={{ width: 24, height: 24, borderRadius: 12 }}
            onSlidingStart={audio.handleSlidingStart}
            onValueChange={audio.handleValueChange}
            onSlidingComplete={audio.handleSlidingComplete}
            disabled={isDisabled}
          />
        </View>
      </View>

      <View style={styles.textArea}>
        <View style={styles.textBox}>
          {loadingText ? (
            <ActivityIndicator />
          ) : (
            <ScrollView
              ref={textScroll.scrollRef as any}
              style={styles.textWindow}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              onLayout={(e) => textScroll.setViewportH(e.nativeEvent.layout.height)}
              onContentSizeChange={(_, h) => textScroll.setContentH(h)}
            >
              <Text style={[styles.textBody, textNotReady && styles.textBodyNotReady]}>{text || ''}</Text>
            </ScrollView>
          )}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  mediaBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDisabled: { opacity: 0.5 },
  playIcon: { fontFamily: 'System', fontSize: 18, fontWeight: '700' },

  sliderOuter: { flex: 1, height: 44, position: 'relative', overflow: 'visible', zIndex: 5 },
  sliderPill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    zIndex: 1,
  },
  sliderDurationOverlay: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', zIndex: 2 },
  sliderAbsolute: { position: 'absolute', left: 0, right: 54, height: 44, top: 0, zIndex: 100, overflow: 'visible', elevation: 10 },
  sliderDurationText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: '#111827',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  textArea: { marginTop: 10 },
  textBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textWindow: { maxHeight: 110 },
  textBody: { fontFamily: typography.sansRegular, fontSize: 14, lineHeight: 22, color: colors.text },
  textBodyNotReady: { color: colors.mutedText, opacity: 0.6 },
});
