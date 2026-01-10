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
import { AmbientMusic } from '@/services/ambientMusic';
import { TexturedBackground } from '@/components/TexturedBackground';
import { useProfileStore } from '@/store/profileStore';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'VoiceSelection'>;

interface Voice {
    id: string;
    displayName: string;
    description: string;
    category: string;
    sampleUrl: string;
}

export const VoiceSelectionScreen = ({ navigation, route }: Props) => {
    const { onSelect, preselectedVoice, productType, systems, readingType, personalContext, relationshipContext, ...restParams } = route.params as any;

    const [voices, setVoices] = useState<Voice[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVoice, setSelectedVoice] = useState<string>(preselectedVoice || 'david');
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    // Fade out ambient music on mount
    useEffect(() => {
        console.log('🎵 VoiceSelectionScreen: Fading out ambient music...');
        AmbientMusic.fadeAndPause();
    }, []);

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
            Alert.alert('Error', 'Could not play voice sample. Please try again.');
            setPlayingVoice(null);
        }
    };

    const handleConfirm = async () => {
        // If productType and systems are passed, start the job directly (new modular flow)
        if (productType && systems && systems.length > 0) {
            await startJobWithVoice(selectedVoice);
            return;
        }
        
        // Legacy callback pattern (for SystemSelection)
        if (onSelect) {
            onSelect(selectedVoice);
            // IMPORTANT: Don't navigate back here.
            // The caller (SystemSelection) will continue the flow (start job + navigate).
            return;
        }
        
        navigation.goBack();
    };

    // Start job with selected voice (new modular approach)
    const startJobWithVoice = async (voiceId: string) => {
        try {
            // Import job creation utilities
            const { env } = await import('@/config/env');
            const { isSupabaseConfigured, supabase } = await import('@/services/supabase');
            const { useOnboardingStore } = await import('@/store/onboardingStore');
            const { useProfileStore } = await import('@/store/profileStore');
            const { useAuthStore } = await import('@/store/authStore');
            
            // Get user ID
            let userId = '00000000-0000-0000-0000-000000000001';
            let accessToken: string | undefined;
            if (isSupabaseConfigured) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.id) userId = session.user.id;
                accessToken = session?.access_token;
            }
            
            // Get person data from stores
            const onboardingStore = useOnboardingStore.getState();
            const profileStore = useProfileStore.getState();
            const authStore = useAuthStore.getState();
            const user = profileStore.people.find(p => p.isUser);
            
            // Build person1 data (from restParams or stores)
            const person1 = (restParams as any).person1Override || {
                id: user?.id || userId,
                name: (restParams as any).userName || (restParams as any).personName || user?.name || authStore.displayName || 'You',
                birthDate: (restParams as any).personBirthDate || onboardingStore.birthDate || user?.birthData?.birthDate,
                birthTime: (restParams as any).personBirthTime || onboardingStore.birthTime || user?.birthData?.birthTime,
                timezone: (restParams as any).personBirthCity?.timezone || onboardingStore.birthCity?.timezone || user?.birthData?.timezone,
                latitude: (restParams as any).personBirthCity?.latitude || onboardingStore.birthCity?.latitude || user?.birthData?.latitude,
                longitude: (restParams as any).personBirthCity?.longitude || onboardingStore.birthCity?.longitude || user?.birthData?.longitude,
                placements: user?.placements, // Include Swiss Eph placements
            };
            
            // Build person2 data (overlay only)
            let person2;
            if (readingType === 'overlay') {
                const partnerId = (restParams as any).partnerId || (restParams as any).personId;
                const partner = profileStore.people.find(p => p.id === partnerId);
                
                person2 = (restParams as any).person2Override || {
                    id: partnerId,
                    name: (restParams as any).partnerName || partner?.name || 'Partner',
                    birthDate: (restParams as any).partnerBirthDate || partner?.birthData?.birthDate,
                    birthTime: (restParams as any).partnerBirthTime || partner?.birthData?.birthTime,
                    timezone: (restParams as any).partnerBirthCity?.timezone || partner?.birthData?.timezone,
                    latitude: (restParams as any).partnerBirthCity?.latitude || partner?.birthData?.latitude,
                    longitude: (restParams as any).partnerBirthCity?.longitude || partner?.birthData?.longitude,
                    placements: partner?.placements, // Include Swiss Eph placements
                };
            }
            
            // Determine job type
            let jobType: 'extended' | 'synastry' | 'nuclear_v2' = 'extended';
            if (productType === 'nuclear_package') jobType = 'nuclear_v2';
            else if (readingType === 'overlay') jobType = 'synastry';
            
            // Build payload
            const payload: any = {
                type: jobType,
                systems,
                style: 'production',
                person1,
                relationshipIntensity: onboardingStore.relationshipIntensity || 5,
                voiceId,
            };
            
            if (person2) {
                payload.person2 = person2;
            }
            if (relationshipContext) {
                payload.relationshipContext = relationshipContext;
            }
            if (personalContext) {
                payload.personalContext = personalContext;
            }
            
            // Start job
            const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify(payload),
            });
            
            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || `Failed to start job (${res.status})`);
            }
            
            const data = await res.json();
            if (!data.jobId) throw new Error('No jobId returned');
            
            // CRITICAL: Store jobId in person's profile so PersonReadingsScreen can find it
            const personId = person1.id || userId;
            const updatePerson = useProfileStore.getState().updatePerson;
            const existingPerson = useProfileStore.getState().people.find(p => p.id === personId);
            
            if (existingPerson) {
                const updatedJobIds = [...(existingPerson.jobIds || []), data.jobId];
                updatePerson(personId, { jobIds: updatedJobIds });
                console.log(`✅ Added jobId ${data.jobId} to person ${person1.name}`);
            }
            
            // Mark people as having paid readings in Supabase
            const { markPersonAsPaidReading } = await import('@/services/peopleService');
            markPersonAsPaidReading(userId, person1.name).catch(err => 
                console.warn('⚠️ Failed to mark person1 as paid:', err)
            );
            if (person2?.name) {
                markPersonAsPaidReading(userId, person2.name).catch(err => 
                    console.warn('⚠️ Failed to mark person2 as paid:', err)
                );
            }
            
            // Navigate to GeneratingReading (NO animation screen)
            navigation.replace('GeneratingReading', {
                jobId: data.jobId,
                productType,
                productName: productType === 'complete_reading' ? 'Complete Reading' : productType === 'nuclear_package' ? 'Nuclear Package' : systems.join(', '),
                personName: person1.name,
                partnerName: person2?.name,
                readingType,
                systems,
                forPartner: (restParams as any).forPartner,
            });
            
        } catch (e: any) {
            console.error('Failed to start job:', e);
            Alert.alert('Error', e?.message || 'Could not start generation. Please try again.');
        }
    };

    if (loading) {
        return (
            <TexturedBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading voices...</Text>
                    </View>
                </SafeAreaView>
            </TexturedBackground>
        );
    }

    return (
        <TexturedBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.homeText}>My Secret Life</Text>
                </TouchableOpacity>
            </View>
            <BackButton onPress={() => navigation.goBack()} />

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
        </TexturedBackground>
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
        paddingVertical: spacing.md, // Reduced from lg
        gap: 0, // Removed gap (using marginBottom on cards instead)
    },
    voiceCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        padding: spacing.md, // Reduced from lg
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
        borderColor: colors.border,
        marginBottom: spacing.sm, // Reduced from md
    },
    voiceCardActive: {
        borderColor: colors.primary,
        borderWidth: 3,
    },
    voiceInfo: {
        flex: 1,
        marginRight: spacing.sm, // Reduced from md
    },
    voiceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4, // Tighter spacing (was spacing.xs)
        gap: spacing.xs, // Reduced from sm
    },
    voiceName: {
        fontFamily: typography.sansBold,
        fontSize: 16, // Smaller (was 18)
        color: colors.text,
    },
    voiceNameActive: {
        color: colors.primary,
    },
    selectedBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xs, // Reduced from sm
        paddingVertical: 2,
        borderRadius: 999,
    },
    selectedBadgeText: {
        fontFamily: typography.sansBold,
        fontSize: 9, // Smaller (was 10)
        color: colors.background,
        letterSpacing: 0.5,
    },
    voiceCategory: {
        fontFamily: typography.sansSemiBold,
        fontSize: 11, // Smaller (was 12)
        color: colors.mutedText,
        textTransform: 'uppercase',
        letterSpacing: 0.5, // Tighter (was 1)
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.buttonBg,
        borderWidth: 1.5, // Thinner (was 2)
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

