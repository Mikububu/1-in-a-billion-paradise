import { useMemo, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Keyboard, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '@/components/Button';
import { searchCities } from '@/services/geonames';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { CityOption } from '@/types/forms';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { calculatePlacements } from '@/services/placementsCalculator';
import { insertPersonToSupabase } from '@/services/peopleService';

type Props = NativeStackScreenProps<MainStackParamList, 'PartnerInfo'>;

const parseIsoDate = (value?: string): Date | null => {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const parseHHMM = (value?: string): Date | null => {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

// IMPORTANT: Do NOT use Date.toISOString() for birth dates. It can shift the day depending
// on the device timezone (e.g. Bangkok), causing false "different birth data" comparisons.
const toIsoDateLocal = (date: Date): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const PartnerInfoScreen = ({ navigation, route }: Props) => {
  const mode = route.params?.mode;
  const returnTo = route.params?.returnTo;
  const isAddPersonOnly = mode === 'add_person_only';

  // Start blank; users can pick from "My People" or type new info.
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthTime, setBirthTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Get people from store to check for duplicates

  const people = useProfileStore((state) => state.people);
  const addPerson = useProfileStore((state) => state.addPerson);
  const userId = useAuthStore((state) => state.userId);

  // City search state
  const [cityQuery, setCityQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<CityOption[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  // Debounced city search
  useEffect(() => {
    if (!cityQuery || cityQuery.length < 2) {
      setCitySuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchCities(cityQuery);
        setCitySuggestions(results);
      } catch (error) {
        console.log('City search error:', error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cityQuery]);

  const handleCitySelect = useCallback((city: CityOption) => {
    Keyboard.dismiss();
    setSelectedCity(city);
    setCityQuery(`${city.name}, ${city.country}`);
    setShowCitySuggestions(false);
  }, []);

  // Require explicit city selection + birth time (compatibility requires Rising sign; no birth time = no entry)
  const canContinue = name.trim() && birthDate && birthTime && selectedCity !== null;

  const upsertPersonFromForm = async (): Promise<{ personId?: string; cityToUse?: CityOption }> => {
    if (!canContinue) return {};

    if (!birthTime) {
      Alert.alert('Birth time required', 'Please add a birth time. Compatibility requires Rising sign accuracy.');
      return {};
    }

    // If selectedCity is null but we have a matching suggestion, use the first one
    let cityToUse = selectedCity;
    if (!cityToUse && citySuggestions.length > 0) {
      // Try to find exact match by name
      const exactMatch = citySuggestions.find(c =>
        cityQuery.toLowerCase().includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(cityQuery.toLowerCase().split(',')[0].trim())
      );
      cityToUse = exactMatch || citySuggestions[0];
    }

    if (!cityToUse) {
      // Still no city - show error
      console.error('No city selected');
      return {};
    }

    // Check for existing person with same name (case-insensitive)
    const normalizedName = name.trim().toLowerCase();
    const existingPerson = people.find(p =>
      p.name?.toLowerCase() === normalizedName && !p.isUser
    );

    if (existingPerson) {
      // Check if birth data matches (same person)
      const existingBirthDate = existingPerson.birthData?.birthDate;
      const existingBirthTime = existingPerson.birthData?.birthTime;
      const existingCity = existingPerson.birthData?.birthCity;

      const newBirthDate = birthDate ? toIsoDateLocal(birthDate) : null;
      const newBirthTime = birthTime ? `${birthTime.getHours().toString().padStart(2, '0')}:${birthTime.getMinutes().toString().padStart(2, '0')}` : null;
      const newCityName = typeof cityToUse === 'object' ? cityToUse.name : cityToUse;

      // If birth data matches (or is very similar), it's the same person - navigate to their readings
      const birthDateMatches = !existingBirthDate || !newBirthDate || existingBirthDate === newBirthDate;
      const birthTimeMatches = !existingBirthTime || !newBirthTime || existingBirthTime === newBirthTime;
      const cityMatches = !existingCity || !newCityName || existingCity === newCityName;

      if (birthDateMatches && birthTimeMatches && cityMatches) {
        // Same person detected - reuse existing person.
        if (isAddPersonOnly) {
          // We just needed them saved; go back to the "choose two people" screen.
          if (returnTo === 'ComparePeople') navigation.navigate('ComparePeople');
          else navigation.goBack();
          return { personId: existingPerson.id, cityToUse };
        }

        // Default flow: go generate their 3 hook readings (Sun/Moon/Rising)
        console.log(`✅ Same person "${name}" detected - navigating to hook readings`);
        navigation.navigate('PartnerCoreIdentities', {
          partnerName: name,
          partnerBirthDate: birthDate ? toIsoDateLocal(birthDate) : undefined,
          partnerBirthTime: birthTime
            ? `${birthTime.getHours().toString().padStart(2, '0')}:${birthTime.getMinutes().toString().padStart(2, '0')}`
            : null,
          partnerBirthCity: cityToUse,
        });
        return { personId: existingPerson.id, cityToUse };
      } else {
        // Different person with same name - show error
        Alert.alert(
          'Name Already Taken',
          `A person named "${name}" already exists in your library with different birth data. Please use a different name to avoid confusion.`,
          [{ text: 'OK' }]
        );
        return {};
      }
    }

    // New person: calculate placements IMMEDIATELY using Swiss Ephemeris
    const nextBirthTime = birthTime
      ? `${birthTime.getHours().toString().padStart(2, '0')}:${birthTime.getMinutes().toString().padStart(2, '0')}`
      : '12:00';

    const birthDataForCalculation = {
      birthDate: birthDate ? toIsoDateLocal(birthDate) : '',
      birthTime: nextBirthTime,
      timezone: cityToUse.timezone,
      latitude: cityToUse.latitude,
      longitude: cityToUse.longitude,
    };

    // Calculate placements NOW (Swiss Ephemeris via backend)
    console.log(`🔮 Calculating placements for ${name.trim()}...`);
    const placements = await calculatePlacements(birthDataForCalculation);

    if (placements) {
      console.log(`✅ Placements ready: ☉${placements.sunSign} ☽${placements.moonSign} ↑${placements.risingSign}`);
    } else {
      console.log('⚠️ Placements calculation failed - will be calculated later');
    }

    const personId = addPerson({
      name: name.trim(),
      isUser: false,
      birthData: {
        birthDate: birthDataForCalculation.birthDate,
        birthTime: birthDataForCalculation.birthTime,
        birthCity: cityToUse.name,
        timezone: cityToUse.timezone,
        latitude: cityToUse.latitude,
        longitude: cityToUse.longitude,
      },
      placements: placements || undefined, // Save placements immediately
    });

    // Sync to Supabase in background
    if (userId) {
      const person = {
        id: personId,
        name: name.trim(),
        isUser: false,
        birthData: {
          birthDate: birthDataForCalculation.birthDate,
          birthTime: birthDataForCalculation.birthTime,
          birthCity: cityToUse.name,
          timezone: cityToUse.timezone,
          latitude: cityToUse.latitude,
          longitude: cityToUse.longitude,
        },
        placements: placements || undefined,
      } as any;

      insertPersonToSupabase(userId, person).then(result => {
        if (result.success) {
          console.log(`✅ Person "${name.trim()}" synced to Supabase`);
        } else {
          console.warn(`⚠️ Failed to sync to Supabase: ${result.error}`);
        }
      });
    }

    if (isAddPersonOnly) {
      if (returnTo === 'ComparePeople') navigation.navigate('ComparePeople');
      else navigation.goBack();
      return { personId, cityToUse };
    }

    navigation.navigate('PartnerCoreIdentities', {
      partnerName: name.trim(),
      partnerBirthDate: birthDate ? toIsoDateLocal(birthDate) : undefined,
      partnerBirthTime: birthTime
        ? `${birthTime.getHours().toString().padStart(2, '0')}:${birthTime.getMinutes().toString().padStart(2, '0')}`
        : null,
      partnerBirthCity: cityToUse,
    });

    return { personId, cityToUse };
  };

  const handleContinue = async () => {
    await upsertPersonFromForm();
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'mm/dd/yyyy';
    return date.toLocaleDateString('en-US');
  };

  const formatTime = (time: Date | null) => {
    if (!time) return '--:--';
    return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
  };


  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenId}>15</Text>
      {/* Header with exit button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: (showTimePicker || showDatePicker) ? 400 : spacing.xl }}
      >
        <View style={styles.content}>
          <Text style={styles.title} selectable>Tell us about...</Text>

          {/* Name Input */}
          <View style={styles.inputRow}>
            <Text style={styles.iconArt}>♡</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Name"
              placeholderTextColor={colors.mutedText}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Date Input */}
          <TouchableOpacity style={styles.inputRow} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.iconArt}>✧</Text>
            <Text style={[styles.inputText, !birthDate && styles.placeholder]}>
              {formatDate(birthDate)}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={birthDate || new Date(1990, 0, 1)}
                mode="date"
                display="spinner"
                onChange={(_, date) => {
                  if (date) setBirthDate(date);
                }}
              />
              <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Time Input */}
          <TouchableOpacity style={styles.inputRow} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.iconArt}>◐</Text>
            <Text style={[styles.inputText, !birthTime && styles.placeholder]}>
              {formatTime(birthTime)}
            </Text>
          </TouchableOpacity>

          {showTimePicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={birthTime || new Date(2000, 0, 1, 12, 0)}
                mode="time"
                display="spinner"
                onChange={(_, time) => {
                  if (time) setBirthTime(time);
                }}
              />
              <TouchableOpacity style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* City Input */}
          <View style={styles.inputRow}>
            <Text style={styles.iconArt}>✶</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Birth city"
              placeholderTextColor={colors.mutedText}
              value={cityQuery}
              onChangeText={(text) => {
                setCityQuery(text);
                setSelectedCity(null);
                setShowCitySuggestions(true);
              }}
              onFocus={() => setShowCitySuggestions(true)}
            />
          </View>

          {/* City Suggestions */}
          {showCitySuggestions && citySuggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {citySuggestions.map((city) => (
                <TouchableOpacity
                  key={city.id}
                  style={styles.suggestionItem}
                  onPress={() => handleCitySelect(city)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>
                    {city.name}{city.region ? `, ${city.region}` : ''}
                  </Text>
                  <Text style={styles.suggestionCountry}>{city.country}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.helperText} selectable>
            Enter their birthtime as exact as possible.
          </Text>
        </View>
      </ScrollView>


      <View style={styles.footer}>
        <Button
          label={isAddPersonOnly ? 'Save Person' : 'Calculate Compatibility'}
          onPress={handleContinue}
          disabled={!canContinue}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenId: {
    position: 'absolute',
    top: 55,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  closeText: {
    fontSize: 24,
    color: colors.text,
    fontFamily: typography.sansRegular,
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: 0, // No top padding to maximize space
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    marginBottom: spacing.md, // Reduced margin
    textAlign: 'center', // Centered headline
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputStroke,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md, // Reduced vertical padding
    marginBottom: spacing.sm, // Reduced margin between inputs
  },
  icon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  iconArt: {
    fontSize: 28,
    marginRight: spacing.sm,
    color: colors.text,
    fontWeight: '300',
  },
  textInput: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  inputText: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  placeholder: {
    color: colors.mutedText,
  },
  pickerContainer: {
    backgroundColor: colors.background,
    borderRadius: radii.card,
    marginBottom: 120, // Extra space to ensure Done button is visible above footer
  },
  pickerDone: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  pickerDoneText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.primary,
  },
  suggestionsBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    marginBottom: spacing.sm,
  },
  suggestionItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  suggestionText: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.text,
  },
  suggestionCountry: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
  },
  helperText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
  },
});
