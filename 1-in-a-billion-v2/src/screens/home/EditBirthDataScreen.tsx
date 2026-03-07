import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
    Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { t } from '@/i18n';
import type { CityOption } from '@/types/forms';
import { CitySearchSheet } from '@/components/CitySearchSheet';
import { calculatePlacements } from '@/services/placementsCalculator';
import { syncPeopleToSupabase } from '@/services/peopleCloud';
import { useProfileStore } from '@/store/profileStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/Button';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'EditBirthData'>;

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

export const EditBirthDataScreen = ({ navigation, route }: Props) => {
    const { personId } = route.params || {};

    const getUser = useProfileStore((s) => s.getUser);
    const getPerson = useProfileStore((s) => s.getPerson);
    const updatePerson = useProfileStore((s) => s.updatePerson);

    const setBirthDate = useOnboardingStore((s) => s.setBirthDate);
    const setBirthTime = useOnboardingStore((s) => s.setBirthTime);
    const setBirthCity = useOnboardingStore((s) => s.setBirthCity);

    const authUser = useAuthStore((s) => s.user);
    const userId = authUser?.id;

    const person = useMemo(() => {
        if (personId) return getPerson(personId);
        return getUser();
    }, [getPerson, getUser, personId]);

    const [dateValue, setDateValue] = useState(() => toDisplayDate(person?.birthData?.birthDate));
    const [timeValue, setTimeValue] = useState(() => parseTime(person?.birthData?.birthTime));
    const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showCitySheet, setShowCitySheet] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!person?.birthData) return;
        const bd = person.birthData;
        if (bd.birthCity && bd.timezone && Number.isFinite(bd.latitude) && Number.isFinite(bd.longitude)) {
            setSelectedCity({
                id: `saved-${person.id}`,
                name: bd.birthCity,
                country: '',
                latitude: bd.latitude,
                longitude: bd.longitude,
                timezone: bd.timezone,
            });
        }
    }, [person?.birthData, person?.id]);

    const handleCitySelect = useCallback((city: CityOption) => {
        setSelectedCity(city);
    }, []);

    const canSave = useMemo(() => Boolean(dateValue && timeValue && selectedCity), [dateValue, timeValue, selectedCity]);

    const handleSave = useCallback(async () => {
        if (!canSave || !selectedCity) return;
        if (!person) {
            Alert.alert(t('editBirthData.profileNotFound'), t('editBirthData.profileNotFoundMessage'));
            return;
        }

        setSaving(true);
        try {
            const nextBirthData = {
                birthDate: toIsoDate(dateValue),
                birthTime: toTimeString(timeValue),
                birthCity: selectedCity.name,
                timezone: selectedCity.timezone,
                latitude: selectedCity.latitude,
                longitude: selectedCity.longitude,
            };

            updatePerson(person.id, {
                birthData: nextBirthData,
                placements: undefined,
            });

            if (person.isUser) {
                setBirthDate(nextBirthData.birthDate);
                setBirthTime(nextBirthData.birthTime);
                setBirthCity(selectedCity);
            }

            const placements = await calculatePlacements(nextBirthData);
            if (placements) {
                updatePerson(person.id, { placements });
            }

            if (userId) {
                const currentPeople = useProfileStore.getState().people;
                await syncPeopleToSupabase(userId, currentPeople);
            }

            navigation.goBack();
        } catch (error) {
            console.error('Failed to save birth data:', error);
            Alert.alert(t('editBirthData.saveFailed'), t('editBirthData.saveFailedMessage'));
        } finally {
            setSaving(false);
        }
    }, [canSave, dateValue, navigation, person, selectedCity, setBirthCity, setBirthDate, setBirthTime, timeValue, updatePerson, userId]);

    const cityDisplayText = selectedCity
        ? selectedCity.country
            ? `${selectedCity.name}, ${selectedCity.country}`
            : selectedCity.name
        : undefined;

    return (
        <SafeAreaView style={styles.safeArea}>
            <BackButton onPress={() => navigation.goBack()} />
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={styles.header}>
                    <View style={{ width: 60 }} />
                    <Text style={styles.headerTitle}>{t('editBirthData.title')}</Text>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={styles.title}>{person?.name || t('editBirthData.defaultName')}</Text>
                    <Text style={styles.subtitle}>
                        {t('editBirthData.subtitle')}
                    </Text>

                    <Pressable style={styles.inputRow} onPress={() => { Keyboard.dismiss(); setShowDatePicker(!showDatePicker); }}>
                        <Text style={styles.iconArt}>✧</Text>
                        <Text style={styles.inputText}>{formatDateDisplay(dateValue)}</Text>
                    </Pressable>
                    {showDatePicker && (
                        <View style={styles.pickerWrapper} onTouchStart={() => Keyboard.dismiss()}>
                            <DateTimePicker
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                value={dateValue}
                                onChange={(_, nextDate) => {
                                    if (Platform.OS === 'android') setShowDatePicker(false);
                                    if (nextDate) setDateValue(nextDate);
                                }}
                            />
                            {Platform.OS === 'ios' && (
                                <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                                    <Text style={styles.pickerDoneText}>{t('editBirthData.done')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <Pressable style={styles.inputRow} onPress={() => { Keyboard.dismiss(); setShowTimePicker(!showTimePicker); }}>
                        <Text style={styles.iconArt}>◐</Text>
                        <Text style={styles.inputText}>{toTimeString(timeValue)}</Text>
                    </Pressable>
                    {showTimePicker && (
                        <View style={styles.pickerWrapper} onTouchStart={() => Keyboard.dismiss()}>
                            <DateTimePicker
                                mode="time"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                value={timeValue}
                                is24Hour={true}
                                onChange={(_, nextTime) => {
                                    if (Platform.OS === 'android') setShowTimePicker(false);
                                    if (nextTime) setTimeValue(nextTime);
                                }}
                            />
                            {Platform.OS === 'ios' && (
                                <TouchableOpacity style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
                                    <Text style={styles.pickerDoneText}>{t('editBirthData.done')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* City Input — opens bottom sheet */}
                    <Pressable style={styles.inputRow} onPress={() => setShowCitySheet(true)}>
                        <Text style={styles.iconArt}>✶</Text>
                        <Text style={[styles.inputText, !selectedCity && styles.placeholder]} numberOfLines={1}>
                            {cityDisplayText || t('editBirthData.cityPlaceholder')}
                        </Text>
                        <Text style={styles.chevron}>›</Text>
                    </Pressable>

                    <CitySearchSheet
                        visible={showCitySheet}
                        onClose={() => setShowCitySheet(false)}
                        onSelect={handleCitySelect}
                        selected={selectedCity}
                    />

                    <View style={{ height: spacing.xl }} />
                    <Button label={saving ? t('editBirthData.saving') : t('editBirthData.save')} onPress={handleSave} disabled={!canSave || saving} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    container: { flex: 1, backgroundColor: 'transparent' },
    header: {
        marginTop: 72,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.page,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    headerTitle: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
    scrollContent: { padding: spacing.page, paddingBottom: spacing.xl * 2 },
    title: { fontFamily: typography.headline, fontSize: 32, color: colors.text },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBg,
        borderWidth: 1,
        borderColor: colors.inputStroke,
        borderRadius: 24,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        marginBottom: spacing.sm,
    },
    iconArt: { fontSize: 24, marginRight: spacing.sm, color: colors.text, fontWeight: '300' },
    inputText: { flex: 1, fontFamily: typography.sansRegular, fontSize: 16, color: colors.text },
    placeholder: { color: colors.mutedText },
    chevron: {
        fontSize: 22,
        color: colors.mutedText,
        fontFamily: typography.sansRegular,
        marginLeft: spacing.xs,
    },
    pickerWrapper: { backgroundColor: colors.background, borderRadius: radii.card, marginBottom: spacing.sm },
    pickerDone: { alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
    pickerDoneText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.primary },
});
