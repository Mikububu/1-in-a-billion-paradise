/**
 * TREE OF LIFE VIDEO SCREEN
 * 
 * Plays the Tree of Life animation after voice selection
 * and before the generation screen begins.
 * Auto-navigates to GeneratingReading when video completes.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'TreeOfLifeVideo'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TreeOfLifeVideoScreen = ({ navigation, route }: Props) => {
    const videoRef = useRef<Video>(null);
    const hasNavigated = useRef(false);
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Pass through all params to GeneratingReading
    const {
        jobId,
        productType,
        productName,
        personName,
        partnerName,
        readingType,
        systems,
        forPartner,
    } = route.params;

    const navigateToGenerating = () => {
        if (hasNavigated.current) return;
        hasNavigated.current = true;

        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('🌳 TreeOfLifeVideo → GeneratingReading', { jobId, productType, readingType, systems });
        }
        
        // Safety check: If jobId is missing, log error and go to Home
        if (!jobId) {
          console.error('❌ CRITICAL: TreeOfLifeVideo missing jobId! Params:', route.params);
          navigation.replace('Home');
          return;
        }
        
        navigation.replace('GeneratingReading', {
            jobId,
            productType,
            productName,
            personName,
            partnerName,
            readingType,
            systems,
            forPartner,
        });
    };

    const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
            navigateToGenerating();
        }
    };

    // Fallback: if video doesn't finish properly, navigate after timeout
    useEffect(() => {
        // Start with a conservative fallback; we tighten this once duration is known.
        fallbackTimerRef.current = setTimeout(() => {
            navigateToGenerating();
        }, 45000); // 45s max

        return () => {
          if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        };
    }, []);

    // Set audio mode to play in silent mode on iOS
    useEffect(() => {
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      }).catch(() => {});
    }, []);

    useEffect(() => {
      // Best-effort: explicitly kick playback on mount (helps some iOS edge cases).
      videoRef.current?.playAsync().catch(() => {});
    }, []);

    return (
        <View style={styles.container}>
            <Video
                ref={videoRef}
                source={require('../../../assets/videos/tree_of_life.mp4')}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping={false}
                isMuted={false} // Audio enabled for Tree of Life video
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onLoad={(status) => {
                  // Use actual duration to set a better fallback (duration + 1s, capped).
                  const duration = (status as any)?.durationMillis;
                  if (typeof duration === 'number' && duration > 0) {
                    const ms = Math.min(duration + 1000, 45000);
                    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
                    fallbackTimerRef.current = setTimeout(() => {
                      navigateToGenerating();
                    }, ms);
                  }
                }}
                onError={(e) => {
                  // eslint-disable-next-line no-console
                  console.warn('🌳 TreeOfLifeVideo failed to load/play:', (e as any)?.error || e);
                  // Don’t strand the user on a black screen.
                  setTimeout(() => navigateToGenerating(), 800);
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    video: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
});
