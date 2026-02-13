import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { VOICE_OPTIONS } from '@/config/voices';
import { env } from '@/config/env';
import { buildPromptLayerDirective } from '@/config/promptLayers';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<MainStackParamList, 'VoiceSelection'>;

const SYSTEM_LABELS: Record<string, string> = {
    western: 'Western Astrology',
    vedic: 'Vedic',
    human_design: 'Human Design',
    gene_keys: 'Gene Keys',
    kabbalah: 'Kabbalah',
};

export const VoiceSelectionScreen = ({ navigation, route }: Props) => {
    const {
        productType,
        systems = [],
        readingType = 'individual',
        preselectedVoice,
        personalContext,
        relationshipContext,
        ...restParams
    } = (route.params || {}) as any;

    const authUser = useAuthStore((s) => s.user);
    const getPerson = useProfileStore((s) => s.getPerson);
    const getUser = useProfileStore((s) => s.getUser);
    const relationshipPreferenceScale = useOnboardingStore((s) => s.relationshipPreferenceScale);
    const storedVoiceId = useOnboardingStore((s) => s.voiceId);
    const setVoiceId = useOnboardingStore((s) => s.setVoiceId);

    const [selectedVoice, setSelectedVoice] = useState<string>(
        preselectedVoice || storedVoiceId || VOICE_OPTIONS[0]?.id || 'david'
    );
    const [isLoading, setIsLoading] = useState(false);

    const productName = useMemo(() => {
        if (productType === 'complete_reading') return 'All 5 Systems';
        if (productType === 'nuclear_package') return 'Nuclear Package';
        if (systems.length === 1) return SYSTEM_LABELS[systems[0]] || systems[0];
        if (systems.length > 1) return 'Selected Systems';
        return 'Reading';
    }, [productType, systems]);

    const selectedVoiceLabel = useMemo(() => {
        return VOICE_OPTIONS.find((v) => v.id === selectedVoice)?.label || selectedVoice;
    }, [selectedVoice]);

    const handleStart = async () => {
        if (isLoading) return;

        if (!productType) {
            Alert.alert('Missing product', 'No product type was provided for this reading.');
            return;
        }

        if (!Array.isArray(systems) || systems.length === 0) {
            Alert.alert('Missing systems', 'No system was selected for this reading.');
            return;
        }

        const self = getUser();
        const targetPerson = restParams.personId ? getPerson(restParams.personId) : null;
        const partnerFromStore = restParams.partnerId ? getPerson(restParams.partnerId) : null;

        const person1 = restParams.person1Override
            ? restParams.person1Override
            : targetPerson
                ? {
                    id: targetPerson.id,
                    name: targetPerson.name,
                    birthDate: targetPerson.birthData?.birthDate,
                    birthTime: targetPerson.birthData?.birthTime,
                    timezone: targetPerson.birthData?.timezone,
                    latitude: targetPerson.birthData?.latitude,
                    longitude: targetPerson.birthData?.longitude,
                    placements: targetPerson.placements,
                }
                : self
                    ? {
                        id: self.id,
                        name: self.name,
                        birthDate: self.birthData?.birthDate,
                        birthTime: self.birthData?.birthTime,
                        timezone: self.birthData?.timezone,
                        latitude: self.birthData?.latitude,
                        longitude: self.birthData?.longitude,
                        placements: self.placements,
                    }
                    : null;

        const person2 = restParams.person2Override
            ? restParams.person2Override
            : partnerFromStore
                ? {
                    id: partnerFromStore.id,
                    name: partnerFromStore.name,
                    birthDate: partnerFromStore.birthData?.birthDate,
                    birthTime: partnerFromStore.birthData?.birthTime,
                    timezone: partnerFromStore.birthData?.timezone,
                    latitude: partnerFromStore.birthData?.latitude,
                    longitude: partnerFromStore.birthData?.longitude,
                    placements: partnerFromStore.placements,
                }
                : readingType === 'overlay' && restParams.partnerName && restParams.partnerBirthDate && restParams.partnerBirthTime && restParams.partnerBirthCity
                    ? {
                        name: restParams.partnerName,
                        birthDate: restParams.partnerBirthDate,
                        birthTime: restParams.partnerBirthTime,
                        timezone: restParams.partnerBirthCity.timezone,
                        latitude: restParams.partnerBirthCity.latitude,
                        longitude: restParams.partnerBirthCity.longitude,
                    }
                    : null;

        if (!person1?.birthDate || !person1?.birthTime || !person1?.timezone) {
            Alert.alert('Missing birth data', 'Person 1 must have complete birth data.');
            return;
        }

        if (readingType === 'overlay' && (!person2?.birthDate || !person2?.birthTime || !person2?.timezone)) {
            Alert.alert('Missing birth data', 'Person 2 must have complete birth data for compatibility readings.');
            return;
        }

        const xUserId = authUser?.id || '00000000-0000-0000-0000-000000000001';
        const jobType = productType === 'nuclear_package'
            ? 'nuclear_v2'
            : (readingType === 'overlay' ? 'synastry' : 'extended');

        const payload: any = {
            type: jobType,
            systems,
            style: 'production',
            promptLayerDirective: buildPromptLayerDirective(systems),
            person1,
            relationshipPreferenceScale: relationshipPreferenceScale ?? 5,
            voiceId: selectedVoice,
        };

        if (readingType === 'overlay' && person2) {
            payload.person2 = person2;
        }

        if (relationshipContext) {
            payload.relationshipContext = relationshipContext;
        }

        if (personalContext) {
            payload.personalContext = personalContext;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': xUserId,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(txt || `Failed to start job (${res.status})`);
            }

            const data = await res.json();
            const newJobId = data?.jobId;
            if (!newJobId) {
                throw new Error('No jobId returned from backend');
            }

            setVoiceId(selectedVoice);

            navigation.replace('TreeOfLifeVideo', {
                jobId: newJobId,
                productType,
                productName,
                personName: person1.name || restParams.targetPersonName || restParams.userName || 'You',
                partnerName: person2?.name || restParams.partnerName,
                systems,
                readingType,
                forPartner: restParams.forPartner,
                personId: person1.id,
                partnerId: person2?.id,
            });
        } catch (error: any) {
            Alert.alert('Could not start job', error?.message || 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <View style={styles.content}>
                <Text style={styles.title}>Choose Your Speaker</Text>
                <Text style={styles.subtitle}>
                    The reading will be narrated by {selectedVoiceLabel}.
                </Text>

                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                    {VOICE_OPTIONS.map((voice) => {
                        const selected = voice.id === selectedVoice;
                        return (
                            <TouchableOpacity
                                key={voice.id}
                                style={[styles.voiceCard, selected && styles.voiceCardSelected]}
                                onPress={() => setSelectedVoice(voice.id)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.voiceInfo}>
                                    <Text style={styles.voiceLabel}>{voice.label}</Text>
                                    <Text style={styles.voiceDescription}>{voice.description}</Text>
                                </View>
                                <Text style={[styles.check, selected && styles.checkSelected]}>
                                    {selected ? '●' : '○'}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <Button
                    label={isLoading ? 'Starting...' : 'Continue to Tree of Life'}
                    onPress={handleStart}
                    disabled={isLoading}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    topSpacer: {
        height: 72,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.lg,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
    },
    subtitle: {
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
    },
    list: {
        flex: 1,
    },
    listContent: {
        gap: spacing.sm,
        paddingBottom: spacing.md,
    },
    voiceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    voiceCardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    voiceInfo: {
        flex: 1,
    },
    voiceLabel: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    voiceDescription: {
        marginTop: 2,
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
    },
    check: {
        fontFamily: typography.sansSemiBold,
        fontSize: 18,
        color: colors.mutedText,
    },
    checkSelected: {
        color: colors.primary,
    },
});
