import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography } from '@/theme/tokens';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { useOnboardingStore } from '@/store/onboardingStore';
import { VOICES } from '@/config/readingConfig';

type Props = NativeStackScreenProps<MainStackParamList, 'FullReading'>;

const TEST_PARTNER = {
  name: 'Test Partner',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthCity: {
    id: 'test',
    country: 'Test Country',
    name: 'Test City',
    timezone: 'UTC',
    latitude: 0,
    longitude: 0,
  }
};

/**
 * FullReading (legacy route name) — Redirect-only
 *
 * Requirement: the old "ALMOST READY / zodiac" FullReading UI should not exist anymore.
 * This screen starts an "extended" job for the selected system and immediately routes into
 * the unified Generating UI (`GeneratingReadingScreen`).
 */
export const FullReadingRedirectScreen = ({ navigation, route }: Props) => {
  const { system = 'western', forPartner, partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity } =
    route.params || {};

  const [starting, setStarting] = useState(true);

  const meName = useOnboardingStore((s) => s.name) || 'User';
  const meBirthDate = useOnboardingStore((s) => s.birthDate);
  const meBirthTime = useOnboardingStore((s) => s.birthTime);
  const meCity = useOnboardingStore((s) => s.birthCity);
  const relationshipIntensity = useOnboardingStore((s) => s.relationshipIntensity) || 5;

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // Person 1 data (individual reading)
        const person1 =
          forPartner
            ? {
              name: partnerName || (__DEV__ ? TEST_PARTNER.name : 'Partner'),
              birthDate: partnerBirthDate || (__DEV__ ? TEST_PARTNER.birthDate : undefined),
              birthTime: partnerBirthTime || (__DEV__ ? TEST_PARTNER.birthTime : undefined),
              timezone: (partnerBirthCity as any)?.timezone || (__DEV__ ? TEST_PARTNER.birthCity.timezone : undefined),
              latitude: (partnerBirthCity as any)?.latitude ?? (__DEV__ ? TEST_PARTNER.birthCity.latitude : undefined),
              longitude: (partnerBirthCity as any)?.longitude ?? (__DEV__ ? TEST_PARTNER.birthCity.longitude : undefined),
            }
            : {
              name: meName,
              birthDate: meBirthDate,
              birthTime: meBirthTime,
              timezone: (meCity as any)?.timezone,
              latitude: (meCity as any)?.latitude,
              longitude: (meCity as any)?.longitude,
            };

        // Validate required birth data
        if (
          !person1.birthDate ||
          !person1.birthTime ||
          !person1.timezone ||
          typeof person1.latitude !== 'number' ||
          typeof person1.longitude !== 'number'
        ) {
          Alert.alert('Birth data required', 'Please complete birth date, time, and city before starting a reading.', [
            { text: 'Edit Birth Data', onPress: () => navigation.navigate('EditBirthData') },
          ]);
          navigation.goBack();
          return;
        }

        // Get user ID for queue ownership
        let xUserId = '00000000-0000-0000-0000-000000000001';
        if (isSupabaseConfigured) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.user?.id) xUserId = session.user.id;
          } catch {
            // ignore
          }
        }

        const payload: any = {
          type: 'extended',
          systems: [system],
          style: 'production',
          person1,
          relationshipIntensity,
          voiceId: 'Grandpa', // Safeguard: Default to Grandpa
          audioUrl: VOICES.Grandpa, // Safeguard: Default to Grandpa's URL
        };

        const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': xUserId,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || `Failed to start job (${res.status})`);
        }
        const data = await res.json();
        const newJobId = data?.jobId;
        if (!newJobId) throw new Error('No jobId returned from backend');

        if (cancelled) return;
        navigation.replace('GeneratingReading', {
          jobId: newJobId,
          productType: 'single_system',
          productName: String(system),
          personName: person1.name,
          systems: [system],
          readingType: 'individual',
          forPartner: !!forPartner,
        });
      } catch (e: any) {
        if (cancelled) return;
        Alert.alert('Could not start reading', e?.message || 'Unknown error');
        navigation.goBack();
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    start();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>{starting ? 'Starting…' : 'Redirecting…'}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  text: { fontFamily: typography.sansRegular, color: colors.mutedText },
});
