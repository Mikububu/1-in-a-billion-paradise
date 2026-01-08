/**
 * VOICE SELECTION SCREEN
 * 
 * Full-screen dedicated voice selection with proper space for descriptions
 * and voice sample playback. Replaces the cramped modal overlay.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';

type Props = NativeStackScreenProps<MainStackParamList, 'VoiceSelection'>;

interface Voice {
    id: string;
    displayName: string;
    description: string;
    category: string;
    sampleUrl: string;
}

export const VoiceSelectionScreen = ({ navigation, route }: Props) => {
    const { onSelect, preselectedVoice } = route.params || {};

    const [voices, setVoices] = useState<Voice[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVoice, setSelectedVoice] = useState<string>(preselectedVoice || 'grandpa');
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    // Fetch voices from API
    useEffect(() => {
        fetchVoices();
    }, []);

    const fetchWithTimeout = async (url: string, options: RequestInit & { timeoutMs?: number } = {}) => {
        const { timeoutMs = 12000, ...rest } = options;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...rest, signal: controller.signal });
        } finally {
            clearTimeout(t);
        }
    };

    const fetchVoices = async () => {
        try {
            setLoading(true);
            const baseCandidates = [
                env.CORE_API_URL,
                // Helpful dev fallbacks if local backend is up but env points elsewhere (or vice versa)
                'http://172.20.10.2:8787',
                'http://localhost:8787',
                'http://127.0.0.1:8787',
                'https://1-in-a-billion-backend.fly.dev',
            ];
            const bases = Array.from(new Set(baseCandidates.filter(Boolean)));

            let lastErr: any = null;
            for (const base of bases) {
                const url = `${base}/api/voices/samples`;
                try {
                    const response = await fetchWithTimeout(url, { timeoutMs: 12000 });
                    if (!response.ok) {
                        lastErr = new Error(`HTTP ${response.status}`);
                        continue;
                    }
                    const data = await response.json();
                    if (data.success && data.voices) {
                        setVoices(data.voices);
                        if (!preselectedVoice && data.voices.length > 0) {
                            setSelectedVoice(data.voices[0].id);
                        }
                        lastErr = null;
                        break;
                    }
                    lastErr = new Error('Bad response payload');
                } catch (e: any) {
                    lastErr = e;
                    continue;
                }
            }

            if (lastErr) {
                throw lastErr;
            }
        } catch (err) {
            console.error('Failed to fetch voices:', err);
            Alert.alert('Error', 'Could not load voices. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Cleanup sound
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    const playVoiceSample = async (voiceId: string) => {
        try {
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
            }

            if (playingVoice === voiceId) {
                setPlayingVoice(null); // Stop if clicking same
                return;
            }

            const voice = voices.find(v => v.id === voiceId);
            if (!voice || !voice.sampleUrl) {
                Alert.alert('Error', 'Voice sample not available');
                return;
            }

            console.log(`🔊 Playing sample for ${voice.displayName}: ${voice.sampleUrl}`);
            setPlayingVoice(voiceId);

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: voice.sampleUrl },
                { shouldPlay: true }
            );
            setSound(newSound);

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingVoice(null);
                }
            });
        } catch (err) {
            console.error('Failed to play voice sample:', err);
            Alert.alert('Error', 'Could not play voice sample. Please try again.');
            setPlayingVoice(null);
        }
    };

    const handleConfirm = () => {
        if (onSelect) {
            onSelect(selectedVoice);
            // IMPORTANT: Don't navigate back here.
            // The caller (SystemSelection) will continue the flow (start job + navigate).
            return;
        }
        navigation.goBack();
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading voices...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.homeText}>My Secret Life</Text>
                </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
                <Text style={styles.title}>Choose Your Narrator</Text>
                <Text style={styles.subtitle}>
                    Select the voice that will narrate your personal reading. Tap to preview each voice.
                </Text>
            </View>

            {/* Voice List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {voices.map((voice) => {
                    const isActive = selectedVoice === voice.id;
                    const isPlaying = playingVoice === voice.id;

                    return (
                        <TouchableOpacity
                            key={voice.id}
                            style={[styles.voiceCard, isActive && styles.voiceCardActive]}
                            onPress={() => setSelectedVoice(voice.id)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.voiceInfo}>
                                <View style={styles.voiceHeader}>
                                    <Text style={[styles.voiceName, isActive && styles.voiceNameActive]}>
                                        {voice.displayName}
                                    </Text>
                                    {isActive && (
                                        <View style={styles.selectedBadge}>
                                            <Text style={styles.selectedBadgeText}>✓ Selected</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.voiceCategory}>{voice.category}</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.playButton, isPlaying && styles.playButtonActive]}
                                onPress={() => playVoiceSample(voice.id)}
                            >
                                <Text style={[styles.playIcon, isPlaying && styles.playIconActive]}>
                                    {isPlaying ? '■' : '▶'}
                                </Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.continueButton}
                    onPress={handleConfirm}
                    activeOpacity={0.8}
                >
                    <Text style={styles.continueButtonText}>CONTINUE WITH {voices.find(v => v.id === selectedVoice)?.displayName?.toUpperCase()}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.page,
        paddingVertical: spacing.md,
    },
    backButton: {
        paddingVertical: spacing.xs,
    },
    backText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    homeText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.primary,
    },
    titleContainer: {
        paddingHorizontal: spacing.page,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 20,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.page,
        paddingVertical: spacing.lg,
        gap: spacing.md,
    },
    voiceCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    voiceCardActive: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    voiceInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    voiceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
        gap: spacing.sm,
    },
    voiceName: {
        fontFamily: typography.sansBold,
        fontSize: 18,
        color: colors.text,
    },
    voiceNameActive: {
        color: colors.primary,
    },
    selectedBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 999,
    },
    selectedBadgeText: {
        fontFamily: typography.sansBold,
        fontSize: 10,
        color: colors.background,
        letterSpacing: 0.5,
    },
    voiceCategory: {
        fontFamily: typography.sansSemiBold,
        fontSize: 12,
        color: colors.mutedText,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    playButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    playIcon: {
        color: colors.text,
        fontSize: 18,
        marginLeft: 0, // Centered properly
    },
    playIconActive: {
        color: colors.background,
    },
    footer: {
        paddingHorizontal: spacing.page,
        paddingVertical: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    continueButton: {
        backgroundColor: colors.primary,
        borderRadius: radii.button,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    continueButtonText: {
        fontFamily: typography.sansBold,
        fontSize: 16,
        color: colors.background,
        letterSpacing: 0.5,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
    },
});

