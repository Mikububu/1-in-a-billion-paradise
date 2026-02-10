import { useEffect, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { readingsApi } from '@/services/api';
import { HookReading } from '@/types/forms';
import { useOnboardingStore } from '@/store/onboardingStore';

const readingTypes: HookReading['type'][] = ['sun', 'moon', 'rising'];

export const useHookReadings = () => {
  // Get individual values to avoid creating new object references
  const birthDate = useOnboardingStore((state) => state.birthDate);
  const birthTime = useOnboardingStore((state) => state.birthTime);
  const birthCity = useOnboardingStore((state) => state.birthCity);
  const primaryLanguage = useOnboardingStore((state) => state.primaryLanguage);
  const relationshipIntensity = useOnboardingStore((state) => state.relationshipIntensity);
  const relationshipMode = useOnboardingStore((state) => state.relationshipMode);
  const secondaryLanguage = useOnboardingStore((state) => state.secondaryLanguage);
  const setHookReading = useOnboardingStore((state) => state.setHookReading);

  const hasRequiredData = Boolean(birthDate && birthTime && birthCity && primaryLanguage);

  const languageImportance = useOnboardingStore((state) => state.languageImportance);

  const readingPayload = useMemo(() => {
    if (!hasRequiredData || !birthCity || !primaryLanguage) return undefined;
    return {
      birthDate: birthDate!,
      birthTime: birthTime!,
      timezone: birthCity.timezone,
      latitude: birthCity.latitude,
      longitude: birthCity.longitude,
      relationshipIntensity,
      relationshipMode,
      primaryLanguage: primaryLanguage.code,
      secondaryLanguage: secondaryLanguage?.code,
      languageImportance,
    };
  }, [birthDate, birthTime, birthCity, primaryLanguage, relationshipIntensity, relationshipMode, secondaryLanguage, languageImportance]);

  const queries = useQueries({
    queries: readingTypes.map((type) => ({
      queryKey: ['reading', type, birthDate, birthTime, birthCity?.id],
      queryFn: () => {
        if (!readingPayload) {
          throw new Error('Missing profile input');
        }
        return readingsApi[type](readingPayload);
      },
      enabled: hasRequiredData,
      retry: 1,
      staleTime: Infinity,
    })),
  });

  const [sunResult, moonResult, risingResult] = queries;

  useEffect(() => {
    [sunResult?.data?.reading, moonResult?.data?.reading, risingResult?.data?.reading].forEach((nextReading) => {
      if (nextReading) {
        setHookReading(nextReading);
      }
    });
  }, [sunResult?.data, moonResult?.data, risingResult?.data, setHookReading]);

  return {
    sun: sunResult?.data?.reading,
    moon: moonResult?.data?.reading,
    rising: risingResult?.data?.reading,
    isLoading: [sunResult, moonResult, risingResult].some((query) => query?.isLoading),
    isError: [sunResult, moonResult, risingResult].some((query) => !!query?.error),
    refetchAll: () => [sunResult, moonResult, risingResult].forEach((query) => query?.refetch()),
  };
};
