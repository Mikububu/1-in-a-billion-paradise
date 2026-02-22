import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@/config/env';
import { isSupabaseConfigured } from '@/services/supabase';
import { fetchPeopleFromSupabase, syncPeopleToSupabase } from '@/services/peopleCloud';
import { syncCompatibilityReadingsToSupabase } from '@/services/compatibilityCloud';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

const SIGNATURE_FIELDS = (person: any) => ({
    id: person.id,
    name: person.name,
    isUser: person.isUser,
    birthData: person.birthData,
    placements: person.placements,
    hookReadings: person.hookReadings,
    hookAudioPaths: person.hookAudioPaths,
    portraitUrl: person.portraitUrl,
    originalPhotoUrl: person.originalPhotoUrl,
    jobIds: person.jobIds,
    readings: (person.readings || []).map((reading: any) => ({
        id: reading.id,
        system: reading.system,
        generatedAt: reading.generatedAt,
        jobId: reading.jobId,
        docNum: reading.docNum,
        pdfPath: reading.pdfPath,
        audioPath: reading.audioPath,
        songPath: reading.songPath,
    })),
});

const buildPeopleSignature = (people: any[]) =>
    JSON.stringify((people || []).map(SIGNATURE_FIELDS));

const buildCompatibilitySignature = (readings: any[]) =>
    JSON.stringify(
        (readings || []).map((reading: any) => ({
            id: reading.id,
            person1Id: reading.person1Id,
            person2Id: reading.person2Id,
            system: reading.system,
            spicyScore: reading.spicyScore,
            safeStableScore: reading.safeStableScore,
            generatedAt: reading.generatedAt,
            source: reading.source,
        }))
    );

export const useSupabaseLibraryAutoSync = () => {
    const authUser = useAuthStore((s) => s.user);
    const people = useProfileStore((s) => s.people);
    const compatibilityReadings = useProfileStore((s) => s.compatibilityReadings);
    const upsertPersonById = useProfileStore((s) => s.upsertPersonById);
    const replaceCompatibilityReadings = useProfileStore((s) => s.replaceCompatibilityReadings);

    const userId = authUser?.id || null;
    const cloudEnabled = Boolean(env.ENABLE_SUPABASE_LIBRARY_SYNC && isSupabaseConfigured && userId);

    const didHydrateRef = useRef(false);
    const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pushInFlightRef = useRef(false);
    const retryAttemptRef = useRef(0);
    const lastPushedSignatureRef = useRef<string>('');
    const [retryNonce, setRetryNonce] = useState(0);

    const clearRetryTimer = useCallback(() => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    const scheduleRetry = useCallback(() => {
        clearRetryTimer();

        const cappedAttempt = Math.min(retryAttemptRef.current, 6);
        const baseMs = Math.min(60000, 2000 * Math.pow(2, cappedAttempt));
        const jitterMs = Math.floor(Math.random() * 600);
        const delayMs = baseMs + jitterMs;

        retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            setRetryNonce((prev) => prev + 1);
        }, delayMs);
    }, [clearRetryTimer]);

    const runPush = useCallback(
        async (signatureHint?: string) => {
            if (!cloudEnabled || !userId || !didHydrateRef.current) return;
            if (pushInFlightRef.current) return;

            const latestPeople = useProfileStore.getState().people;
            const latestCompatibility = useProfileStore.getState().compatibilityReadings;
            const nextSignature =
                signatureHint ||
                `${buildPeopleSignature(latestPeople)}|${buildCompatibilitySignature(latestCompatibility)}`;

            if (nextSignature === lastPushedSignatureRef.current) {
                retryAttemptRef.current = 0;
                clearRetryTimer();
                return;
            }

            pushInFlightRef.current = true;
            try {
                const [peopleResult, compatibilityResult] = await Promise.all([
                    syncPeopleToSupabase(userId, latestPeople as any),
                    syncCompatibilityReadingsToSupabase(userId, latestCompatibility as any),
                ]);

                if (!peopleResult.success) {
                    throw new Error(peopleResult.error || 'People sync failed');
                }

                if (!compatibilityResult.success) {
                    throw new Error(compatibilityResult.error || 'Compatibility sync failed');
                }

                if (!compatibilityResult.skipped && compatibilityResult.readings) {
                    replaceCompatibilityReadings(compatibilityResult.readings);
                }

                const pushedPeople = useProfileStore.getState().people;
                const pushedCompatibility = useProfileStore.getState().compatibilityReadings;
                lastPushedSignatureRef.current = `${buildPeopleSignature(pushedPeople)}|${buildCompatibilitySignature(
                    pushedCompatibility
                )}`;

                retryAttemptRef.current = 0;
                clearRetryTimer();
                console.log(
                    `☁️ Cloud push complete: ${pushedPeople.length} people, ${pushedCompatibility.length} compatibility previews`
                );
            } catch (error: any) {
                retryAttemptRef.current += 1;
                console.warn('⚠️ Cloud push failed, scheduling retry', {
                    attempt: retryAttemptRef.current,
                    reason: error?.message || error,
                });
                scheduleRetry();
            } finally {
                pushInFlightRef.current = false;
            }
        },
        [clearRetryTimer, cloudEnabled, replaceCompatibilityReadings, scheduleRetry, userId]
    );

    useEffect(() => {
        didHydrateRef.current = false;
        lastPushedSignatureRef.current = '';
        retryAttemptRef.current = 0;
        pushInFlightRef.current = false;
        if (pushTimerRef.current) {
            clearTimeout(pushTimerRef.current);
            pushTimerRef.current = null;
        }
        clearRetryTimer();
    }, [clearRetryTimer, userId]);

    useEffect(() => {
        let mounted = true;
        if (!cloudEnabled || !userId || didHydrateRef.current) return;
        didHydrateRef.current = true;

        (async () => {
            try {
                const result = await fetchPeopleFromSupabase(userId);
                if (!mounted || !result.success) return;

                for (const person of result.people) {
                    upsertPersonById(person);
                }

                const compatibilityResult = await syncCompatibilityReadingsToSupabase(
                    userId,
                    useProfileStore.getState().compatibilityReadings
                );
                if (
                    mounted &&
                    compatibilityResult.success &&
                    !compatibilityResult.skipped &&
                    compatibilityResult.readings
                ) {
                    replaceCompatibilityReadings(compatibilityResult.readings);
                }

                const latestPeople = useProfileStore.getState().people;
                const latestCompatibility = useProfileStore.getState().compatibilityReadings;
                lastPushedSignatureRef.current = `${buildPeopleSignature(latestPeople)}|${buildCompatibilitySignature(
                    latestCompatibility
                )}`;
                console.log(`☁️ Cloud hydration complete: ${result.people.length} people`);
            } catch (error) {
                console.warn('⚠️ Cloud hydration failed', error);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [cloudEnabled, replaceCompatibilityReadings, upsertPersonById, userId]);

    useEffect(() => {
        if (!cloudEnabled || !userId || !didHydrateRef.current) return;

        const nextSignature = `${buildPeopleSignature(people)}|${buildCompatibilitySignature(
            compatibilityReadings
        )}`;
        if (nextSignature === lastPushedSignatureRef.current) return;

        if (pushTimerRef.current) clearTimeout(pushTimerRef.current);

        pushTimerRef.current = setTimeout(() => {
            void runPush(nextSignature);
        }, 1200);

        return () => {
            if (pushTimerRef.current) {
                clearTimeout(pushTimerRef.current);
                pushTimerRef.current = null;
            }
        };
    }, [cloudEnabled, compatibilityReadings, people, runPush, userId]);

    useEffect(() => {
        if (!cloudEnabled || !userId || !didHydrateRef.current) return;
        if (retryNonce <= 0) return;
        void runPush();
    }, [cloudEnabled, retryNonce, runPush, userId]);
};
