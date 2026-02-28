import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Video, ResizeMode, type AVPlaybackStatus, Audio } from 'expo-av';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'TreeOfLifeVideo'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TreeOfLifeVideoScreen = ({ navigation, route }: Props) => {
    const videoRef = useRef<Video>(null);
    const hasNavigated = useRef(false);
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        jobId,
        productType,
        productName,
        personName,
        partnerName,
        readingType,
        systems,
        forPartner,
        personId,
        partnerId,
    } = route.params;

    const navigateToGenerating = () => {
        if (hasNavigated.current) return;
        hasNavigated.current = true;

        if (!jobId) {
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
            personId,
            partnerId,
        });
    };

    const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
            navigateToGenerating();
        }
    };

    useEffect(() => {
        fallbackTimerRef.current = setTimeout(() => {
            navigateToGenerating();
        }, 45000);
        return () => {
            if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        };
    }, []);

    useEffect(() => {
        Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
        }).catch((e) => console.warn('Audio mode setup error:', e));
    }, []);

    useEffect(() => {
        videoRef.current?.playAsync().catch((e) => console.warn('Video play error:', e));
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
                isMuted={false}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onLoad={(status) => {
                    const duration = (status as any)?.durationMillis;
                    if (typeof duration === 'number' && duration > 0) {
                        const ms = Math.min(duration + 1000, 45000);
                        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
                        fallbackTimerRef.current = setTimeout(() => navigateToGenerating(), ms);
                    }
                }}
                onError={() => {
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

