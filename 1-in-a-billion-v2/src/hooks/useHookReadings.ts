import { useCallback, useEffect, useMemo } from 'react';
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
    const relationshipPreferenceScale = useOnboardingStore((state) => state.relationshipPreferenceScale);
    const secondaryLanguage = useOnboardingStore((state) => state.secondaryLanguage);
    const setHookReading = useOnboardingStore((state) => state.setHookReading);
    const cachedSun = useOnboardingStore((state) => state.hookReadings.sun);
    const cachedMoon = useOnboardingStore((state) => state.hookReadings.moon);
    const cachedRising = useOnboardingStore((state) => state.hookReadings.rising);

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
            relationshipPreferenceScale,
            primaryLanguage: primaryLanguage.code,
            secondaryLanguage: secondaryLanguage?.code,
            languageImportance,
        };
    }, [birthDate, birthTime, birthCity, primaryLanguage, relationshipPreferenceScale, secondaryLanguage, languageImportance]);

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

    const refetchAll = useCallback(() => {
        [sunResult, moonResult, risingResult].forEach((query) => query?.refetch());
    }, [moonResult, risingResult, sunResult]);

    return {
        sun: sunResult?.data?.reading || cachedSun,
        moon: moonResult?.data?.reading || cachedMoon,
        rising: risingResult?.data?.reading || cachedRising,
        isLoading: [sunResult, moonResult, risingResult].some((query) => query?.isLoading),
        isError: [sunResult, moonResult, risingResult].some((query) => !!query?.error),
        hasRequiredData,
        refetchAll,
    };
};
