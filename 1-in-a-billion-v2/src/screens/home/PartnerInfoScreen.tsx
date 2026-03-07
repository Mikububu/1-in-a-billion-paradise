import { useMemo, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Keyboard, ScrollView, Alert, Image, Dimensions, Platform, KeyboardAvoidingView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '@/components/Button';
import { TexturedBackground } from '@/components/TexturedBackground';
import { CitySearchSheet } from '@/components/CitySearchSheet';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { CityOption } from '@/types/forms';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { calculatePlacements } from '@/services/placementsCalculator';
import { insertPersonToSupabase } from '@/services/peopleService';
import { t } from '@/i18n';

type Props = NativeStackScreenProps<MainStackParamList, 'PartnerInfo'>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const [showCitySheet, setShowCitySheet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get people from store to check for duplicates

  const people = useProfileStore((state) => state.people);
  const addPerson = useProfileStore((state) => state.addPerson);
  const userId = useAuthStore((state: any) => state.user?.id || null);
  const isPrepayOnboarding = (route?.params as any)?.mode === 'onboarding_hook';
  // mode already derived above; keep a typed alias if needed elsewhere
  const flowMode = (route?.params as any)?.mode as string | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // HARD LOCK: Only allow ONE free third person hook reading during onboarding
  // Only count people added in the current onboarding session (last 30 min)
  // to avoid false positives from synced data of previous accounts/sessions.
  // ═══════════════════════════════════════════════════════════════════════════
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const existingFreePartner = people.find(
    (p) => !p.isUser && p.hookReadings && p.hookReadings.length === 3 && p.createdAt > thirtyMinAgo
  );

  useEffect(() => {
    if (isPrepayOnboarding && existingFreePartner) {
      // Already have a free partner hook reading - block creating another
      Alert.alert(
        t('partnerInfo.alreadyCreated'),
        t('partnerInfo.alreadyCreatedMessage'),
        [{
          text: t('common.ok'),
          onPress: () => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('HookSequence' as any, { initialReading: 'rising' });
            }
          },
        }]
      );
    }
  }, [isPrepayOnboarding, existingFreePartner, navigation]);

  // City selection state (explicit selection via CitySearchSheet)
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);

  const handleCitySelect = useCallback((city: CityOption) => {
    setSelectedCity(city);
  }, []);

  // Require explicit city selection + birth time
  const canContinue = useMemo(
    () =>
      Boolean(
        name.trim() &&
        birthDate &&
        birthTime &&
        selectedCity !== null
      ),
    [name, birthDate, birthTime, selectedCity]
  );

  const upsertPersonFromForm = async (): Promise<{ personId?: string; cityToUse?: CityOption }> => {
    if (!canContinue || !selectedCity) return {};

    if (!birthTime) {
      Alert.alert(t('partnerInfo.birthTimeRequired'), t('partnerInfo.birthTimeRequiredMessage'));
      return {};
    }

    const cityToUse = selectedCity;

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
      const newCityName = cityToUse.name;

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
        const targetScreenDup = isPrepayOnboarding ? 'Onboarding_PartnerCoreIdentities' : 'PartnerCoreIdentities';

        const params = {
          partnerName: name,
          partnerBirthDate: birthDate ? toIsoDateLocal(birthDate) : undefined,
          partnerBirthTime: birthTime
            ? `${birthTime.getHours().toString().padStart(2, '0')}:${birthTime.getMinutes().toString().padStart(2, '0')}`
            : null,
          partnerBirthCity: cityToUse,
          partnerId: existingPerson.id,
          mode: flowMode,
        };

        if (isPrepayOnboarding) {
          navigation.replace(targetScreenDup as any, params);
        } else {
          navigation.navigate(targetScreenDup as any, params);
        }

        return { personId: existingPerson.id, cityToUse };
      } else {
        // Different person with same name - show error
        Alert.alert(
          t('partnerInfo.nameAlreadyTaken'),
          t('partnerInfo.nameAlreadyTakenMessage', { name }),
          [{ text: t('common.ok') }]
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

    // Sync to Supabase in background (disabled in pre-payment onboarding)
    if (userId && !isPrepayOnboarding) {
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
      // Navigate to photo upload as a follow-up step (user can skip)
      navigation.replace('PersonPhotoUpload', {
        personId,
        returnTo: returnTo === 'ComparePeople' ? 'ComparePeople' : 'PeopleList',
      });
      return { personId, cityToUse };
    }

    const targetScreen = isPrepayOnboarding ? 'Onboarding_PartnerCoreIdentities' : 'PartnerCoreIdentities';

    const params = {
      partnerName: name.trim(),
      partnerBirthDate: birthDate ? toIsoDateLocal(birthDate) : undefined,
      partnerBirthTime: birthTime
        ? `${birthTime.getHours().toString().padStart(2, '0')}:${birthTime.getMinutes().toString().padStart(2, '0')}`
        : null,
      partnerBirthCity: cityToUse,
      partnerId: personId,
      mode: flowMode,
    };

    if (isPrepayOnboarding) {
      navigation.replace(targetScreen as any, params);
    } else {
      navigation.navigate(targetScreen as any, params);
    }

    return { personId, cityToUse };
  };

  const handleContinue = async () => {
    Keyboard.dismiss();
    if (isSubmitting) return; // Prevent double-clicks
    setIsSubmitting(true);
    try {
      await upsertPersonFromForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'mm/dd/yyyy';
    return date.toLocaleDateString('en-US');
  };

  const formatTime = (time: Date | null) => {
    if (!time) return '--:--';
    return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
  };

  const cityDisplayText = selectedCity
    ? `${selectedCity.name}, ${selectedCity.country}`
    : undefined;

  return (
    <TexturedBackground style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header with exit button */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (isPrepayOnboarding) {
                  // Navigate back to the Rising sign reading (last real page)
                  // instead of goBack() which lands on the gateway spinner page
                  // ("Just a moment…") that has no exit mechanism.
                  (navigation as any).navigate('HookSequence', { initialReading: 'rising' });
                  return;
                }
                navigation.goBack();
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: (showTimePicker || showDatePicker) ? 400 : spacing.xl }}
          >
            <View style={styles.content}>
              <Text style={styles.title}>Tell us about...</Text>

              {/* Name Input */}
              <View style={styles.inputRow}>
                <Text style={styles.iconArt}>♡</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={t('partnerInfo.namePlaceholder')}
                  placeholderTextColor={colors.mutedText}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              {/* Date Input */}
              <TouchableOpacity style={styles.inputRow} onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}>
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
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, date) => {
                      if (Platform.OS === 'android') setShowDatePicker(false);
                      if (date) setBirthDate(date);
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Time Input */}
              <TouchableOpacity style={styles.inputRow} onPress={() => { Keyboard.dismiss(); setShowTimePicker(true); }}>
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
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, time) => {
                      if (Platform.OS === 'android') setShowTimePicker(false);
                      if (time) setBirthTime(time);
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* City Input — opens bottom sheet */}
              <Pressable style={styles.inputRow} onPress={() => setShowCitySheet(true)}>
                <Text style={styles.iconArt}>✶</Text>
                <Text style={[styles.inputText, !selectedCity && styles.placeholder]} numberOfLines={1}>
                  {cityDisplayText || t('partnerInfo.cityPlaceholder')}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <CitySearchSheet
                visible={showCitySheet}
                onClose={() => setShowCitySheet(false)}
                onSelect={handleCitySelect}
                selected={selectedCity}
              />

            </View>

            {/* Spacer to push button down if content is short */}
            <View style={{ flex: 1 }} />

            <View style={styles.footer}>
              <Button
                label={isAddPersonOnly ? 'Save Person' : 'Calculate Compatibility'}
                onPress={handleContinue}
                disabled={!canContinue || isSubmitting}
              />
            </View>

          </ScrollView>

          {/* 5 Systems Image - Half screen size, behind button */}
          <View pointerEvents="none" style={styles.bottomImageWrap}>
            <Image
              source={require('../../../assets/images/5_systems_transp.png')}
              style={styles.bottomImage}
              resizeMode="contain"
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TexturedBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Let TexturedBackground show through
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
  chevron: {
    fontSize: 22,
    color: colors.mutedText,
    fontFamily: typography.sansRegular,
    marginLeft: spacing.xs,
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
  footer: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    zIndex: 10,
  },
  bottomImageWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5, // Half screen size
    width: '100%',
    zIndex: -1, // Behind everything, allows touch through
  },
  bottomImage: {
    height: '100%',
    width: '100%',
  },
});
