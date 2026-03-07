import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Animated,
    Image,
    ImageSourcePropType,
    Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { BackButton } from '@/components/BackButton';
import { CitySearchSheet } from '@/components/CitySearchSheet';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { CityOption } from '@/types/forms';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';
import { t } from '@/i18n';

// City images
const CITY_IMAGES: ImageSourcePropType[] = [
    require('../../../assets/images/cities/hongkong.png'),
    require('../../../assets/images/cities/villach.png'),
    require('../../../assets/images/cities/vienna.png'),
    require('../../../assets/images/cities/newyork.png'),
];

const toDisplayDate = (value?: string) => {
    if (!value) return new Date(1992, 0, 1);
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
};

const toIsoDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseTime = (value?: string) => {
    if (!value) return new Date(1992, 0, 1, 12, 0);
    const [hour, minute] = value.split(':').map(Number);
    return new Date(1992, 0, 1, hour ?? 12, minute ?? 0);
};

const toTimeString = (date: Date) => {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
};

const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

export const BirthInfoScreen = () => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();

    const storedDate = useOnboardingStore((state: any) => state.birthDate);
    const storedTime = useOnboardingStore((state: any) => state.birthTime);
    const storedCity = useOnboardingStore((state: any) => state.birthCity);
    const setBirthDate = useOnboardingStore((state: any) => state.setBirthDate);
    const setBirthTime = useOnboardingStore((state: any) => state.setBirthTime);
    const setBirthCity = useOnboardingStore((state: any) => state.setBirthCity);

    const [dateValue, setDateValue] = useState(() => toDisplayDate(storedDate));
    const [timeValue, setTimeValue] = useState(() => parseTime(storedTime));
    const [selectedCity, setSelectedCity] = useState<CityOption | undefined>(storedCity);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showCitySheet, setShowCitySheet] = useState(false);
    const { isPlaying } = useMusicStore();

    // Keep ambient music playing
    useFocusEffect(
        useCallback(() => {
            if (isPlaying) {
                AmbientMusic.play();
            }
        }, [isPlaying])
    );

    // Simple slideshow - just change image index
    const [imageIndex, setImageIndex] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const interval = setInterval(() => {
            // Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 3000,
                useNativeDriver: true,
            }).start(() => {
                setImageIndex((i) => (i + 1) % CITY_IMAGES.length);
                // Fade in
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 3000,
                    useNativeDriver: true,
                }).start();
            });
        }, 8000);
        return () => clearInterval(interval);
    }, [fadeAnim]);

    const handleCitySelect = useCallback((city: CityOption) => {
        setSelectedCity(city);

        if (__DEV__) {
            console.log('🏙️ City selected:', {
                name: city.name,
                country: city.country,
                timezone: city.timezone,
                lat: city.latitude,
                lng: city.longitude,
                hasTimezone: !!city.timezone,
            });
        }

        if (!city.timezone) {
            console.error('❌ CRITICAL: Selected city has no timezone!', JSON.stringify(city));
        }

        setBirthCity(city);
    }, [setBirthCity]);

    const canContinue = useMemo(() => {
        return Boolean(dateValue && timeValue && selectedCity);
    }, [dateValue, timeValue, selectedCity]);

    const handleContinue = () => {
        if (!canContinue) return;
        setBirthDate(toIsoDate(dateValue));
        setBirthTime(toTimeString(timeValue));
        if (selectedCity) setBirthCity(selectedCity);
        navigation.navigate('Languages');
    };

    const cityDisplayText = selectedCity
        ? `${selectedCity.name}, ${selectedCity.country}`
        : undefined;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <BackButton onPress={() => navigation.goBack()} />

            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.title} selectable>{t('birthInfo.title')}</Text>

                    {/* Date Input */}
                    <Pressable
                        style={styles.inputRow}
                        onPress={() => { Keyboard.dismiss(); setShowDatePicker(!showDatePicker); }}
                    >
                        <Text style={styles.iconArt}>✧</Text>
                        <Text style={[styles.inputText, !storedDate && styles.placeholder]}>
                            {storedDate ? formatDateDisplay(dateValue) : t('birthInfo.datePlaceholder')}
                        </Text>
                    </Pressable>

                    {showDatePicker && (
                        <View style={styles.pickerWrapper} onTouchStart={() => Keyboard.dismiss()}>
                            <DateTimePicker
                                mode="date"
                                display="spinner"
                                value={dateValue}
                                onChange={(_, nextDate) => {
                                    if (nextDate) {
                                        setDateValue(nextDate);
                                        setBirthDate(toIsoDate(nextDate));
                                    }
                                }}
                            />
                            <TouchableOpacity
                                style={styles.pickerDone}
                                onPress={() => setShowDatePicker(false)}
                            >
                                <Text style={styles.pickerDoneText}>{t('birthInfo.done')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Time Input */}
                    <Pressable
                        style={styles.inputRow}
                        onPress={() => { Keyboard.dismiss(); setShowTimePicker(!showTimePicker); }}
                    >
                        <Text style={styles.iconArt}>◐</Text>
                        <Text style={[styles.inputText, !storedTime && styles.placeholder]}>
                            {storedTime || t('birthInfo.timePlaceholder')}
                        </Text>
                    </Pressable>

                    {showTimePicker && (
                        <View style={styles.pickerWrapper} onTouchStart={() => Keyboard.dismiss()}>
                            <DateTimePicker
                                mode="time"
                                display="spinner"
                                value={timeValue}
                                is24Hour={true}
                                onChange={(_, nextTime) => {
                                    if (nextTime) {
                                        setTimeValue(nextTime);
                                        setBirthTime(toTimeString(nextTime));
                                    }
                                }}
                            />
                            <TouchableOpacity
                                style={styles.pickerDone}
                                onPress={() => setShowTimePicker(false)}
                            >
                                <Text style={styles.pickerDoneText}>{t('birthInfo.done')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* City Input — opens bottom sheet */}
                    <Pressable
                        style={styles.inputRow}
                        onPress={() => setShowCitySheet(true)}
                    >
                        <Text style={styles.iconArt}>✶</Text>
                        <Text style={[styles.inputText, !selectedCity && styles.placeholder]} numberOfLines={1}>
                            {cityDisplayText || t('birthInfo.cityPlaceholder')}
                        </Text>
                        <Text style={styles.chevron}>›</Text>
                    </Pressable>

                    <CitySearchSheet
                        visible={showCitySheet}
                        onClose={() => setShowCitySheet(false)}
                        onSelect={handleCitySelect}
                        selected={selectedCity}
                    />

                    <Text style={styles.helper} selectable>
                        {t('birthInfo.helper')}
                    </Text>
                </ScrollView>

                {/* City image - pointerEvents="none" so touches pass through to button */}
                <View pointerEvents="none" style={styles.imageWrapper}>
                    <Animated.Image
                        source={CITY_IMAGES[imageIndex]}
                        style={[styles.bottomImage, { opacity: fadeAnim }]}
                        resizeMode="contain"
                    />
                </View>

                {/* Button at very bottom */}
                <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                    <Button
                        label={t('birthInfo.continue')}
                        onPress={handleContinue}
                        disabled={!canContinue}
                    />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        paddingHorizontal: spacing.page,
        paddingTop: 80,
        paddingBottom: spacing.lg,
    },
    title: {
        fontFamily: typography.serifBold,
        fontSize: 26,
        lineHeight: 32,
        color: colors.text,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.inputStroke,
        borderRadius: radii.button,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 4,
        marginBottom: spacing.sm,
        backgroundColor: colors.inputBg,
    },
    iconArt: {
        fontSize: 28,
        color: colors.text,
        marginRight: spacing.sm,
        fontWeight: '300',
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
    chevron: {
        fontSize: 22,
        color: colors.mutedText,
        fontFamily: typography.sansRegular,
        marginLeft: spacing.xs,
    },
    pickerWrapper: {
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.cardStroke,
        backgroundColor: colors.surface,
        marginBottom: spacing.sm,
        overflow: 'hidden',
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
    helper: {
        fontFamily: typography.sansBold,
        fontSize: 14,
        color: colors.primary,
        marginTop: spacing.sm,
        fontWeight: '700',
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: spacing.page,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        backgroundColor: 'transparent',
    },
    imageWrapper: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        zIndex: 0,
    },
    bottomImage: {
        width: '100%',
        height: 300,
    },
});
