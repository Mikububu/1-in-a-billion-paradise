import { SimpleSlider } from '@/components/SimpleSlider';
import { useMemo, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { AutocompleteInput, AutocompleteOption } from '@/components/AutocompleteInput';
import { languages } from '@/data/languages';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { LanguageOption } from '@/types/forms';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';
import { BackButton } from '@/components/BackButton';

export const LanguagesScreen = () => {
    const navigation = useNavigation<any>();
    const primaryLanguage = useOnboardingStore((state: any) => state.primaryLanguage);
    const secondaryLanguage = useOnboardingStore((state: any) => state.secondaryLanguage);
    const setPrimaryLanguage = useOnboardingStore((state: any) => state.setPrimaryLanguage);
    const setSecondaryLanguage = useOnboardingStore((state: any) => state.setSecondaryLanguage);
    const languageImportance = useOnboardingStore((state: any) => state.languageImportance);
    const setLanguageImportance = useOnboardingStore((state: any) => state.setLanguageImportance);
    const { isPlaying } = useMusicStore();

    // Keep ambient music playing
    useFocusEffect(
        useCallback(() => {
            if (isPlaying) {
                AmbientMusic.play();
            }
        }, [isPlaying])
    );

    // Set English as default primary language if none selected
    useEffect(() => {
        if (!primaryLanguage) {
            const english = languages.find((lang) => lang.code === 'en');
            if (english) {
                setPrimaryLanguage(english);
            }
        }
    }, []); // Run once on mount

    const options = useMemo<AutocompleteOption<LanguageOption>[]>(() => {
        return languages.map((lang) => ({
            id: lang.code,
            primary: lang.label,
            value: lang,
        }));
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            {/* Animated mouth GIF at bottom */}
            <Image
                source={require('../../../assets/images/mouth-veo-transparent_1.gif')}
                style={styles.bottomImage}
                resizeMode="contain"
            />

            {/* Back Button */}
            <BackButton onPress={() => navigation.goBack()} />

            {/* Content at top */}
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Languages</Text>
                <Text style={styles.subtitle}>
                    Which languages do you feel most comfortable with? Secondary is optional.
                </Text>

                <View style={styles.body}>
                    <AutocompleteInput
                        label="Primary language"
                        placeholder="English"
                        options={options}
                        onSelect={(lang) => lang && setPrimaryLanguage(lang)}
                        selectedLabel={primaryLanguage?.label}
                    />

                    <AutocompleteInput
                        label="Secondary language"
                        placeholder="Add another"
                        options={options}
                        onSelect={(lang) => lang && setSecondaryLanguage(lang)}
                        selectedLabel={secondaryLanguage?.label}
                        optional
                    />

                    <View style={styles.sliderCard}>
                        <View style={styles.sliderHeader}>
                            <Text style={styles.sliderTitle} selectable>Language importance</Text>
                            <Text style={styles.sliderValue} selectable>{Math.round(languageImportance)}/10</Text>
                        </View>
                        <SimpleSlider
                            minimumValue={0}
                            maximumValue={10}
                            value={languageImportance}
                            onValueChange={(val) => setLanguageImportance(Math.round(val))}
                        />
                    </View>
                </View>

                {/* Footer (Button) Moved Inside ScrollView */}
                <View style={styles.footer}>
                    <Button
                        label="Continue"
                        onPress={() => navigation.navigate('CoreIdentitiesIntro')}
                        disabled={!primaryLanguage}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Keep the root container transparent so the global leather texture shows through.
        backgroundColor: 'transparent',
    },
    content: {
        paddingHorizontal: spacing.page,
        paddingTop: 60, // Aligned with previous screens
        paddingBottom: spacing.xl,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 26,
        lineHeight: 32,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        lineHeight: 22,
        color: colors.mutedText,
        textAlign: 'center',
    },
    body: {
        gap: spacing.lg,
        marginTop: 32,
    },
    footer: {
        marginTop: spacing.sm, // Reduced to move button higher
        marginBottom: spacing.xl,
    },
    bottomImage: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '44%',
        width: '100%',
        alignSelf: 'center',
        zIndex: 0,
    },
    sliderCard: {
        // Transparent & Simplified
        backgroundColor: 'transparent',
        paddingVertical: spacing.md,
        gap: spacing.sm,
        // Removed borders and horizontal padding/background
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sliderTitle: {
        fontFamily: typography.sansSemiBold,
        color: colors.text,
    },
    sliderValue: {
        fontFamily: typography.sansMedium,
        color: colors.primary,
    },
});
