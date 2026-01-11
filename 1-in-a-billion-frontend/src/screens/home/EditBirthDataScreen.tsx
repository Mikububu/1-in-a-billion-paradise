import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { CityOption } from '@/types/forms';
import { searchCities } from '@/services/geonames';
import { useProfileStore } from '@/store/profileStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { recalculateAndUpdatePlacements } from '@/services/peopleService';
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
  const addPerson = useProfileStore((s) => s.addPerson);

  const setBirthDate = useOnboardingStore((s) => s.setBirthDate);
  const setBirthTime = useOnboardingStore((s) => s.setBirthTime);
  const setBirthCity = useOnboardingStore((s) => s.setBirthCity);

  const userId = useAuthStore((s) => s.userId);

  const person = useMemo(() => {
    if (personId) return getPerson(personId);
    return getUser();
  }, [getPerson, getUser, personId]);

  const [dateValue, setDateValue] = useState(() => toDisplayDate(person?.birthData?.birthDate));
  const [timeValue, setTimeValue] = useState(() => parseTime(person?.birthData?.birthTime));
  const [cityQuery, setCityQuery] = useState(person?.birthData?.birthCity || '');
  const [citySuggestions, setCitySuggestions] = useState<CityOption[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // If the person already has lat/long/timezone we can synthesize a pseudo CityOption
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
      } as CityOption);
    }
  }, [person?.birthData, person?.id]);

  // Debounced city search
  useEffect(() => {
    if (!cityQuery || cityQuery.length < 2) {
      setCitySuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchCities(cityQuery);
        setCitySuggestions(results);
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [cityQuery]);

  const handleCitySelect = useCallback((city: CityOption) => {
    Keyboard.dismiss();
    setSelectedCity(city);
    const displayName = city.region ? `${city.name}, ${city.region}, ${city.country}` : `${city.name}, ${city.country}`;
    setCityQuery(displayName);
    setShowCitySuggestions(false);
    setCitySuggestions([]);
  }, []);

  const canSave = useMemo(() => Boolean(dateValue && timeValue && selectedCity), [dateValue, timeValue, selectedCity]);

  const handleSave = useCallback(async () => {
    if (!canSave || !selectedCity) return;
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

      // Ensure person exists
      let target = person;
      if (!target) {
        console.error('❌ ABORT: No self profile exists in EditBirthDataScreen. Cannot save birth data.');
        Alert.alert(
          'Profile Not Found',
          'Your profile could not be found. Please restart the app or contact support.',
          [{ text: 'OK' }]
        );
        return;
      }

      const birthTimeChanged = (target.birthData?.birthTime || '') !== nextBirthData.birthTime;
      const birthDateChanged = (target.birthData?.birthDate || '') !== nextBirthData.birthDate;
      const locationChanged = 
        (target.birthData?.timezone || '') !== nextBirthData.timezone ||
        (target.birthData?.latitude || 0) !== nextBirthData.latitude ||
        (target.birthData?.longitude || 0) !== nextBirthData.longitude;

      console.log('✅ Updating existing profile with edited birth data');
      
      // Update birth data first (locally)
      updatePerson(target.id, {
        birthData: nextBirthData,
        placements: undefined,
      });

      // Keep onboarding store in sync for main user
      if (target.isUser) {
        setBirthDate(nextBirthData.birthDate);
        setBirthTime(nextBirthData.birthTime);
        setBirthCity(selectedCity);
      }

      // If any birth data changed, recalculate placements via Swiss Eph + sync to Supabase
      if ((birthDateChanged || birthTimeChanged || locationChanged) && userId) {
        console.log('🔮 Birth data changed - recalculating placements...');
        
        // Run in background, don't block navigation
        recalculateAndUpdatePlacements(userId, {
          ...target,
          birthData: nextBirthData,
        }).then(result => {
          if (result.success && result.placements) {
            updatePerson(target.id, { placements: result.placements });
            console.log(`✅ Placements: ☉${result.placements.sunSign} ☽${result.placements.moonSign} ↑${result.placements.risingSign}`);
          } else {
            console.warn('⚠️ Placements recalculation failed:', result.error);
          }
        });
      }

      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [addPerson, canSave, dateValue, getPerson, navigation, person, selectedCity, setBirthCity, setBirthDate, setBirthTime, timeValue, updatePerson, userId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackButton onPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={{ width: 60 }} />
          <Text style={styles.headerTitle} selectable>Edit Birth Data</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title} selectable>
            {person?.name || 'Profile'}
          </Text>
          <Text style={styles.subtitle} selectable>
            This information is used for accurate calculations. If you change birth time, previous placements may be cleared.
          </Text>

          {/* Date */}
          <Pressable style={styles.inputRow} onPress={() => setShowDatePicker(!showDatePicker)}>
            <Text style={styles.iconArt}>✧</Text>
            <Text style={styles.inputText}>{formatDateDisplay(dateValue)}</Text>
          </Pressable>
          {showDatePicker && (
            <View style={styles.pickerWrapper}>
              <DateTimePicker
                mode="date"
                display="spinner"
                value={dateValue}
                onChange={(_, nextDate) => {
                  if (nextDate) setDateValue(nextDate);
                }}
              />
              <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Time */}
          <Pressable style={styles.inputRow} onPress={() => setShowTimePicker(!showTimePicker)}>
            <Text style={styles.iconArt}>◐</Text>
            <Text style={styles.inputText}>{toTimeString(timeValue)}</Text>
          </Pressable>
          {showTimePicker && (
            <View style={styles.pickerWrapper}>
              <DateTimePicker
                mode="time"
                display="spinner"
                value={timeValue}
                is24Hour={true}
                onChange={(_, nextTime) => {
                  if (nextTime) setTimeValue(nextTime);
                }}
              />
              <TouchableOpacity style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* City */}
          <View style={styles.inputRow}>
            <Text style={styles.iconArt}>✶</Text>
            <TextInput
              style={styles.cityInput}
              value={cityQuery}
              onChangeText={(text) => {
                setCityQuery(text);
                setSelectedCity(null);
                setShowCitySuggestions(true);
              }}
              placeholder="Search any city…"
              placeholderTextColor={colors.mutedText}
              onFocus={() => setShowCitySuggestions(true)}
            />
            {isSearching && <ActivityIndicator size="small" color={colors.mutedText} />}
          </View>
          {showCitySuggestions && citySuggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {citySuggestions.map((city) => (
                <TouchableOpacity key={city.id} style={styles.suggestionItem} onPress={() => handleCitySelect(city)} activeOpacity={0.7}>
                  <Text style={styles.suggestionText} selectable>
                    {city.name}
                    {city.region ? `, ${city.region}` : ''}
                  </Text>
                  <Text style={styles.suggestionCountry} selectable>{city.country}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: spacing.xl }} />
          <Button label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={!canSave || saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  headerTitle: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  scrollContent: { padding: spacing.page, paddingBottom: spacing.xl * 2 },
  title: { fontFamily: typography.headline, fontSize: 32, color: colors.text },
  subtitle: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, marginTop: spacing.xs, marginBottom: spacing.lg },
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
  cityInput: { flex: 1, fontFamily: typography.sansRegular, fontSize: 16, color: colors.text },
  pickerWrapper: { backgroundColor: colors.background, borderRadius: radii.card, marginBottom: spacing.sm },
  pickerDone: { alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  pickerDoneText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.primary },
  suggestionsBox: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider, borderRadius: radii.card, marginBottom: spacing.sm },
  suggestionItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  suggestionText: { fontFamily: typography.sansMedium, fontSize: 15, color: colors.text },
  suggestionCountry: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText },
});






