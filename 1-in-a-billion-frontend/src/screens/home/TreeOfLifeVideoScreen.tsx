/**
 * TREE OF LIFE VIDEO SCREEN
 * 
 * Plays the Tree of Life animation after voice selection
 * and before the generation screen begins.
 * Auto-navigates to GeneratingReading when video completes.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'TreeOfLifeVideo'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TreeOfLifeVideoScreen = ({ navigation, route }: Props) => {
    const videoRef = useRef<Video>(null);
    const hasNavigated = useRef(false);
    
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
        const timeout = setTimeout(() => {
            navigateToGenerating();
        }, 15000); // 15 second max

        return () => clearTimeout(timeout);
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
                volume={1.0}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
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
