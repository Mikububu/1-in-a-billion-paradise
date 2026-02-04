import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import Slider from '@react-native-community/slider';
import { useAudioContext } from '../contexts/AudioContext';
import { useTextAutoScroll } from '../hooks/useTextAutoScroll';
import { colors, typography, radii } from '@/theme/tokens';

interface AudioPlayerSectionProps {
  audioUrl: string;
  text: string;
  loadingText: boolean;
  type: 'narration' | 'song';
  controlsDisabled?: boolean;
  textNotReady?: boolean; // True when text exists but audio/PDF aren't ready yet
  isPending?: boolean; // True when media is still generating (shows fire animation)
}

export const AudioPlayerSection: React.FC<AudioPlayerSectionProps> = ({
  audioUrl,
  text,
  loadingText,
  type,
  controlsDisabled = false,
  textNotReady = false,
  isPending = false,
}) => {
  const audioCtx = useAudioContext();
  const [seeking, setSeeking] = useState(false);
  
  // Register this audio with the context
  useEffect(() => {
    if (audioUrl) {
      audioCtx.registerAudio(type, audioUrl);
      return () => audioCtx.unregisterAudio(type);
    }
  }, [audioUrl, type]);
  
  // Get state from context
  const state = audioCtx.getState(type);
  const playing = state?.playing ?? false;
  const loading = state?.loading ?? false;
  const buffering = state?.buffering ?? false;
  const pos = state?.pos ?? 0;
  const dur = state?.dur ?? 0;
  const available = state?.available ?? null;
  
  const textScroll = useTextAutoScroll({
    playing,
    seeking,
    pos,
    dur,
  });
  
  // Slider handlers with optimistic updates for smooth scrubbing
  const handleSlidingStart = useCallback(() => {
    setSeeking(true);
    audioCtx.startSeeking(type);
  }, [audioCtx, type]);
  
  const handleValueChange = useCallback((v: number) => {
    audioCtx.updateSeekPosition(type, v);
  }, [audioCtx, type]);
  
  const handleSlidingComplete = useCallback(async (v: number) => {
    setSeeking(false);
    await audioCtx.finishSeeking(type, v);
  }, [audioCtx, type]);
  
  const togglePlayback = useCallback(() => {
    audioCtx.togglePlayback(type);
  }, [audioCtx, type]);

  const isNarration = type === 'narration';
  const primaryColor = isNarration ? colors.primary : '#B8860B'; // Dark goldenrod
  
  // Disable controls if audio not available yet (null = checking, false = not ready)
  const isDisabled = controlsDisabled || available !== true;
  
  // Same icons but greyed out when disabled
  const icon = isNarration ? (playing ? '❚❚' : '▶') : '♪';

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // Gentle pulsing glow - simple and works without native modules
  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isPending) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.3,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      glowOpacity.setValue(0.3);
    }
  }, [isPending, glowOpacity]);

  return (
    <>
      <View style={styles.mediaBlock}>
        <TouchableOpacity
          style={[
            styles.playButton,
            { borderColor: isDisabled ? '#999' : primaryColor, backgroundColor: isDisabled ? '#f5f5f5' : primaryColor + '20' },
            playing && { backgroundColor: primaryColor + '30' },
          ]}
          onPress={togglePlayback}
          disabled={isDisabled}
        >
          {loading || buffering ? (
            <ActivityIndicator color={isDisabled ? '#999' : primaryColor} />
          ) : (
            <Text style={[styles.playIcon, { color: isDisabled ? '#999' : primaryColor }]}>{icon}</Text>
          )}
        </TouchableOpacity>

        <View style={[styles.sliderOuter, isDisabled && !isPending && { opacity: 0.5 }]}>
          {isPending && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glowBorder,
                { opacity: glowOpacity }
              ]}
            />
          )}
          <View
            pointerEvents="none"
            style={[
              styles.sliderPill,
              {
                borderColor: isPending ? 'transparent' : (isDisabled ? '#999' : primaryColor),
                backgroundColor: isDisabled ? '#f0f0f0' : (isPending ? '#FFF8F0' : primaryColor + '15'),
              },
            ]}
          />
          <View pointerEvents="none" style={styles.sliderDurationOverlay}>
            <Text style={[styles.sliderDurationText, isDisabled && { color: '#999' }]}>
              {playing || seeking ? fmt(pos) : (dur ? fmt(dur) : '--:--')}
            </Text>
          </View>
          <Slider
            style={styles.sliderAbsolute}
            value={dur > 0 ? Math.min(pos, dur) : 0}
            minimumValue={0}
            maximumValue={dur || 1}
            minimumTrackTintColor={isDisabled ? '#999' : primaryColor}
            maximumTrackTintColor="transparent"
            thumbTintColor={isDisabled ? '#999' : primaryColor}
            onSlidingStart={handleSlidingStart}
            onValueChange={handleValueChange}
            onSlidingComplete={handleSlidingComplete}
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
  glowBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
    height: 28,
    borderRadius: 999,
    borderWidth: 3,
    borderStyle: 'dotted',
    borderColor: '#FF6B00',
    zIndex: 2,
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
