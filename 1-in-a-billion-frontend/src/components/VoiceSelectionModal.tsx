import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Button } from '@/components/Button';
import { env } from '@/config/env';

// Voice type from API
interface Voice {
    id: string;
    displayName: string;
    description: string;
    category: string;
    sampleUrl: string;
    isTurboPreset?: boolean;
    turboVoiceId?: string;
}

type Props = {
    visible: boolean;
    onConfirm: (voiceId: string) => void;
    onCancel: () => void;
};

export const VoiceSelectionModal = ({ visible, onConfirm, onCancel }: Props) => {
    const storeVoiceId = useOnboardingStore((s) => s.voiceId);
    const setStoreVoiceId = useOnboardingStore((s) => s.setVoiceId);

    const [voices, setVoices] = useState<Voice[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVoice, setSelectedVoice] = useState<string>(storeVoiceId || 'david');
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    // Load voices from hardcoded config
    useEffect(() => {
        if (visible) {
            loadVoices();
        }
    }, [visible]);

    const loadVoices = () => {
        try {
            setLoading(true);
            const { VOICES } = require('../config/voices');
            
            // Sort: Custom voices first, then Turbo presets
            const sortedVoices = [...VOICES].sort((a: any, b: any) => {
                if (a.isTurboPreset !== b.isTurboPreset) {
                    return a.isTurboPreset ? 1 : -1;
                }
                return a.displayName.localeCompare(b.displayName);
            });
            
            setVoices(sortedVoices);
            
            // Set default if store has one
            if (storeVoiceId) {
                setSelectedVoice(storeVoiceId);
            } else if (sortedVoices.length > 0) {
                setSelectedVoice(sortedVoices[0].id);
            }
        } catch (err) {
            console.error('Failed to load voices:', err);
        } finally {
            setLoading(false);
        }
    };

    // Sync with store on open
    useEffect(() => {
        if (visible && storeVoiceId) {
            setSelectedVoice(storeVoiceId);
        }
    }, [visible, storeVoiceId]);

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
                console.log(`🎤 ${voice?.displayName || voiceId} - no preview available`);
                return;
            }

            console.log(`🔊 Playing sample for ${voice.displayName}: ${voice.sampleUrl}`);
            setPlayingVoice(voiceId);

            // Set audio mode for playback
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            });

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
            setPlayingVoice(null);
        }
    };

    const handleConfirm = () => {
        // Save to store
        setStoreVoiceId(selectedVoice);
        // Proceed
        onConfirm(selectedVoice);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>Choose Your Narrator</Text>
                    <Text style={styles.subtitle}>
                        Select the voice for your personal reading.
                    </Text>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Loading voices...</Text>
                        </View>
                    ) : (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                            style={styles.scrollView}
                        >
                            {voices.map((voice) => {
                                const isActive = selectedVoice === voice.id;
                                const isPlaying = playingVoice === voice.id;

                                return (
                                    <TouchableOpacity
                                        key={voice.id}
                                        style={[
                                            styles.voiceCard, 
                                            isActive && styles.voiceCardActive
                                        ]}
                                        onPress={() => setSelectedVoice(voice.id)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.voiceInfoContainer}>
                                            <Text style={[styles.voiceName, isActive && styles.voiceNameActive]}>
                                                {voice.displayName}
                                            </Text>
                                            {voice.description && (
                                                <Text style={styles.voiceDescription} numberOfLines={1}>
                                                    {voice.description}
                                                </Text>
                                            )}
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
                    )}

                    <View style={styles.footer}>
                        <Button
                            label="CONTINUE"
                            onPress={handleConfirm}
                            variant="primary"
                        />
                        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
        maxHeight: '60%',
    },
    title: {
        fontFamily: typography.serif,
        fontSize: 24,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    scrollView: {
        maxHeight: 180,
        marginBottom: spacing.lg,
    },
    scrollContent: {
        paddingHorizontal: spacing.sm,
        gap: spacing.md,
    },
    voiceCard: {
        width: 140, // Slightly wider for names
        height: 60, // Much shorter, list style
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: spacing.md,
        flexDirection: 'row', // Horizontal layout
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
        borderColor: colors.border,
    },
    voiceCardActive: {
        borderColor: colors.primary,
        borderWidth: 3,
    },
    voiceInfoContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    voiceName: {
        fontFamily: typography.sansBold,
        fontSize: 16,
        color: colors.mutedText,
    },
    voiceNameActive: {
        color: colors.primary,
    },
    playButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButtonActive: {
        backgroundColor: colors.primary,
    },
    playIcon: {
        color: colors.text,
        fontSize: 14,
        lineHeight: 16,
        marginLeft: 2,
    },
    playIconActive: {
        color: colors.background,
    },
    footer: {
        gap: spacing.md,
    },
    cancelBtn: {
        alignItems: 'center',
        padding: spacing.sm,
    },
    cancelText: {
        color: colors.mutedText,
        fontFamily: typography.sansRegular,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        minHeight: 180,
    },
    loadingText: {
        marginTop: spacing.md,
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
    },
    voiceDescription: {
        fontFamily: typography.sansRegular,
        fontSize: 11,
        color: colors.mutedText,
        marginTop: 2,
    },
});
