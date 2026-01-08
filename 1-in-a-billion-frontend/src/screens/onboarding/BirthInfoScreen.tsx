import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableOpacity,
  Animated,
  Image,
  ImageSourcePropType,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { searchCities } from '@/services/geonames';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { CityOption } from '@/types/forms';
import { useFocusEffect } from '@react-navigation/native';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BirthInfo'>;

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

export const BirthInfoScreen = ({ navigation }: Props) => {
  const storedDate = useOnboardingStore((state) => state.birthDate);
  const storedTime = useOnboardingStore((state) => state.birthTime);
  const storedCity = useOnboardingStore((state) => state.birthCity);
  const setBirthDate = useOnboardingStore((state) => state.setBirthDate);
  const setBirthTime = useOnboardingStore((state) => state.setBirthTime);
  const setBirthCity = useOnboardingStore((state) => state.setBirthCity);

  const [dateValue, setDateValue] = useState(() => toDisplayDate(storedDate));
  const [timeValue, setTimeValue] = useState(() => parseTime(storedTime));
  const [cityQuery, setCityQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<CityOption[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityOption | undefined>(storedCity);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCurrentCity, setShowCurrentCity] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
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
      } catch (error) {
        console.warn('City search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cityQuery]);

  const handleCitySelect = useCallback((city: CityOption) => {
    Keyboard.dismiss();
    setSelectedCity(city);
    const displayName = city.region
      ? `${city.name}, ${city.region}, ${city.country}`
      : `${city.name}, ${city.country}`;
    setCityQuery(displayName);
    setShowCitySuggestions(false);
    setCitySuggestions([]);
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
    // Flow: BirthInfo → Languages → Account
    navigation.navigate('Languages');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title} selectable>When & where{'\n'}were you born?</Text>

          {/* Date Input */}
          <Pressable
            style={styles.inputRow}
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <Text style={styles.iconArt}>✧</Text>
            <Text style={[styles.inputText, !storedDate && styles.placeholder]}>
              {storedDate ? formatDateDisplay(dateValue) : 'mm/dd/yyyy'}
            </Text>
          </Pressable>

          {showDatePicker && (
            <View style={styles.pickerWrapper}>
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
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Time Input */}
          <Pressable
            style={styles.inputRow}
            onPress={() => setShowTimePicker(!showTimePicker)}
          >
            <Text style={styles.iconArt}>◐</Text>
            <Text style={[styles.inputText, !storedTime && styles.placeholder]}>
              {storedTime || '--:--'}
            </Text>
          </Pressable>

          {showTimePicker && (
            <View style={styles.pickerWrapper}>
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
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* City Input */}
          <View style={styles.inputRow}>
            <Text style={styles.iconArt}>✶</Text>
            <TextInput
              style={styles.cityInput}
              value={cityQuery || (selectedCity ? `${selectedCity.name}, ${selectedCity.country}` : '')}
              onChangeText={(text) => {
                setCityQuery(text);
                setSelectedCity(undefined);
                setShowCitySuggestions(true);
              }}
              placeholder="Search any city..."
              placeholderTextColor={colors.mutedText}
              onFocus={() => setShowCitySuggestions(true)}
            />
            {isSearching && <ActivityIndicator size="small" color={colors.mutedText} />}
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
                  <Text style={styles.suggestionText} selectable>
                    {city.name}
                    {city.region ? `, ${city.region}` : ''}
                  </Text>
                  <Text style={styles.suggestionCountry} selectable>{city.country}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.helper} selectable>
            Enter your birthtime as exact as possible.
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
        <View style={styles.footer}>
          <Button
            label="Continue"
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
    backgroundColor: colors.background,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: spacing.page,
    zIndex: 10,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  container: {
    flex: 1,
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
    borderColor: colors.divider,
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
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
  cityInput: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    flex: 1,
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
  suggestionsBox: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
    maxHeight: 250,
  },
  suggestionItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    minHeight: 50,
    justifyContent: 'center',
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
    marginTop: 2,
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  imageWrapper: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    zIndex: -1,
  },
  bottomImage: {
    width: '100%',
    height: 300,
  },
  overlayImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
