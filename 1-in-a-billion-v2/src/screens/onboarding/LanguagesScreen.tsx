import { SimpleSlider } from '@/components/SimpleSlider';
import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Button } from '@/components/Button';
import { languages } from '@/data/languages';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { LanguageOption } from '@/types/forms';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';
import { BackButton } from '@/components/BackButton';
import { t, setLanguage } from '@/i18n';

export const LanguagesScreen = () => {
    const navigation = useNavigation<any>();
    const setHasPassedLanguages = useOnboardingStore((state: any) => state.setHasPassedLanguages);
    const primaryLanguage = useOnboardingStore((state: any) => state.primaryLanguage);
    const secondaryLanguage = useOnboardingStore((state: any) => state.secondaryLanguage);
    const setPrimaryLanguage = useOnboardingStore((state: any) => state.setPrimaryLanguage);
    const setSecondaryLanguage = useOnboardingStore((state: any) => state.setSecondaryLanguage);
    const languageImportance = useOnboardingStore((state: any) => state.languageImportance);
    const setLanguageImportance = useOnboardingStore((state: any) => state.setLanguageImportance);
    const { isPlaying } = useMusicStore();

    const [showPrimaryPicker, setShowPrimaryPicker] = useState(false);
    const [showSecondaryPicker, setShowSecondaryPicker] = useState(false);

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

    const handlePrimaryChange = (code: string) => {
        const lang = languages.find((l) => l.code === code);
        if (lang) {
            setPrimaryLanguage(lang);
            setLanguage(lang.code);
        }
    };

    const handleSecondaryChange = (code: string) => {
        if (code === '__none__') {
            setSecondaryLanguage(undefined);
        } else {
            const lang = languages.find((l) => l.code === code);
            if (lang) setSecondaryLanguage(lang);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Animated mouth GIF at bottom */}
            <Image
                source={require('../../../assets/images/mouth-veo-transparent_1.gif')}
                style={styles.bottomImage}
                resizeMode="contain"
            />

            {/* Back Button */}
            <BackButton
                onPress={() => {
                    navigation.goBack();
                }}
            />

            {/* Content at top */}
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>{t('languages.title')}</Text>
                <Text style={styles.subtitle}>
                    {t('languages.subtitle')}
                </Text>

                <View style={styles.body}>
                    {/* Primary Language */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.label}>{t('languages.primary')}</Text>
                        <Pressable
                            style={styles.inputRow}
                            onPress={() => {
                                setShowPrimaryPicker(!showPrimaryPicker);
                                setShowSecondaryPicker(false);
                            }}
                        >
                            <Text style={styles.inputText}>
                                {primaryLanguage?.label || t('languages.primaryPlaceholder')}
                            </Text>
                        </Pressable>
                        {showPrimaryPicker && (
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={primaryLanguage?.code || 'en'}
                                    onValueChange={handlePrimaryChange}
                                    style={styles.picker}
                                >
                                    {languages.map((lang) => (
                                        <Picker.Item
                                            key={lang.code}
                                            label={lang.label}
                                            value={lang.code}
                                        />
                                    ))}
                                </Picker>
                                <TouchableOpacity
                                    style={styles.pickerDone}
                                    onPress={() => setShowPrimaryPicker(false)}
                                >
                                    <Text style={styles.pickerDoneText}>{t('birthInfo.done')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Secondary Language */}
                    <View style={styles.fieldWrapper}>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>{t('languages.secondary')}</Text>
                            <Text style={styles.optional}>{t('common.optional')}</Text>
                        </View>
                        <Pressable
                            style={styles.inputRow}
                            onPress={() => {
                                setShowSecondaryPicker(!showSecondaryPicker);
                                setShowPrimaryPicker(false);
                            }}
                        >
                            <Text style={[styles.inputText, !secondaryLanguage && styles.placeholder]}>
                                {secondaryLanguage?.label || t('languages.secondaryPlaceholder')}
                            </Text>
                            {secondaryLanguage ? (
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        setSecondaryLanguage(undefined);
                                        setShowSecondaryPicker(false);
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.clearText}>✕</Text>
                                </TouchableOpacity>
                            ) : null}
                        </Pressable>
                        {showSecondaryPicker && (
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={secondaryLanguage?.code || '__none__'}
                                    onValueChange={handleSecondaryChange}
                                    style={styles.picker}
                                >
                                    <Picker.Item
                                        label={`— ${t('common.removeSelection')} —`}
                                        value="__none__"
                                    />
                                    {languages.map((lang) => (
                                        <Picker.Item
                                            key={lang.code}
                                            label={lang.label}
                                            value={lang.code}
                                        />
                                    ))}
                                </Picker>
                                <TouchableOpacity
                                    style={styles.pickerDone}
                                    onPress={() => setShowSecondaryPicker(false)}
                                >
                                    <Text style={styles.pickerDoneText}>{t('birthInfo.done')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View style={styles.sliderCard}>
                        <View style={styles.sliderHeader}>
                            <Text style={styles.sliderTitle} selectable>{t('languages.importance')}</Text>
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
                        label={t('languages.continue')}
                        onPress={() => {
                            setHasPassedLanguages(true);
                            navigation.navigate('Account', { captureOnly: true } as any);
                        }}
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
        backgroundColor: 'transparent',
    },
    content: {
        paddingHorizontal: spacing.page,
        paddingTop: 60,
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
    fieldWrapper: {
        gap: spacing.xs,
    },
    label: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.text,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optional: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.inputStroke,
        borderRadius: radii.input,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.inputBg,
        minHeight: 48,
    },
    inputText: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        flex: 1,
    },
    placeholder: {
        color: colors.mutedText,
    },
    clearText: {
        fontSize: 16,
        color: colors.mutedText,
        fontFamily: typography.sansRegular,
        paddingHorizontal: spacing.sm,
    },
    pickerWrapper: {
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.cardStroke,
        backgroundColor: colors.surface,
        overflow: 'hidden',
    },
    picker: {
        // iOS wheel picker renders at native height
    },
    pickerDone: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    pickerDoneText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
    footer: {
        marginTop: spacing.sm,
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
        backgroundColor: 'transparent',
        paddingVertical: spacing.md,
        gap: spacing.sm,
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
