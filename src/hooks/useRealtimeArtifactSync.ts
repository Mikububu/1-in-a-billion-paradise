import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore, type Person, type Reading } from '@/store/profileStore';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { fetchJobArtifacts, type JobArtifact } from '@/services/jobArtifacts';

type SyncedPaths = {
    audioPath?: string;
    pdfPath?: string;
    songPath?: string;
};

type RealtimeStatus = {
    isSubscribed: boolean;
    trackedJobs: number;
    lastEventAt: number | null;
    resync: () => Promise<void>;
};

const getDocNum = (artifact: JobArtifact): number => {
    const raw = artifact?.metadata?.docNum;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const buildTrackedJobIds = (people: Person[]): Set<string> => {
    const ids = new Set<string>();
    for (const person of people || []) {
        for (const jobId of person.jobIds || []) {
            if (jobId) ids.add(jobId);
        }
        for (const reading of person.readings || []) {
            if (reading?.jobId) ids.add(reading.jobId);
        }
    }
    return ids;
};

const signatureForArtifacts = (artifacts: JobArtifact[]) =>
    JSON.stringify(
        (artifacts || []).map((a) => ({
            id: a.id,
            artifactType: a.artifact_type,
            path: a.storage_path,
            docNum: getDocNum(a),
        }))
    );

const applyArtifactPathsToReadings = (jobId: string, readings: Reading[], byDocNum: Map<number, SyncedPaths>) => {
    let changed = false;
    const nextReadings = readings.map((reading) => {
        if (!reading.jobId || reading.jobId !== jobId) return reading;
        const docNum = Number(reading.docNum || 1);
        const paths = byDocNum.get(docNum);
        if (!paths) return reading;

        const nextAudioPath = paths.audioPath || reading.audioPath;
        const nextPdfPath = paths.pdfPath || reading.pdfPath;
        const nextSongPath = paths.songPath || reading.songPath;

        if (
            nextAudioPath === reading.audioPath &&
            nextPdfPath === reading.pdfPath &&
            nextSongPath === reading.songPath
        ) {
            return reading;
        }

        changed = true;
        return {
            ...reading,
            audioPath: nextAudioPath,
            pdfPath: nextPdfPath,
            songPath: nextSongPath,
        };
    });

    return { changed, nextReadings };
};

const buildDocArtifactMap = (artifacts: JobArtifact[]): Map<number, SyncedPaths> => {
    const byDocNum = new Map<number, SyncedPaths>();
    const audioPriority: Record<string, number> = {
        audio_m4a: 3,
        audio_mp3: 2,
        audio: 1,
    };
    const audioPickedPriority = new Map<number, number>();

    for (const artifact of artifacts || []) {
        const docNum = getDocNum(artifact);
        const entry = byDocNum.get(docNum) || {};
        const type = String(artifact.artifact_type || '');
        const path = artifact.storage_path;
        if (!path) continue;

        if (type === 'pdf') {
            entry.pdfPath = path;
            byDocNum.set(docNum, entry);
            continue;
        }

        if (type === 'audio_song') {
            entry.songPath = path;
            byDocNum.set(docNum, entry);
            continue;
        }

        if (type.startsWith('audio')) {
            const incomingPriority = audioPriority[type] || 0;
            const currentPriority = audioPickedPriority.get(docNum) || 0;
            if (incomingPriority >= currentPriority) {
                entry.audioPath = path;
                audioPickedPriority.set(docNum, incomingPriority);
                byDocNum.set(docNum, entry);
            }
        }
    }

    return byDocNum;
};

const useRealtimeArtifactSyncInternal = (): RealtimeStatus => {
    const userId = useAuthStore((s) => s.user?.id || null);
    const isAuthReady = useAuthStore((s) => s.isAuthReady);
    const people = useProfileStore((s) => s.people);
    const replacePeople = useProfileStore((s) => s.replacePeople);

    const [isSubscribed, setIsSubscribed] = useState(false);
    const [lastEventAt, setLastEventAt] = useState<number | null>(null);

    const channelRef = useRef<RealtimeChannel | null>(null);
    const inFlightByJobRef = useRef<Set<string>>(new Set());
    const lastSignatureByJobRef = useRef<Map<string, string>>(new Map());
    const trackedJobIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        trackedJobIdsRef.current = buildTrackedJobIds(people);
    }, [people]);

    const syncSingleJob = useCallback(
        async (jobId: string) => {
            if (!jobId) return;
            if (inFlightByJobRef.current.has(jobId)) return;

            inFlightByJobRef.current.add(jobId);
            try {
                const artifacts = await fetchJobArtifacts(jobId);
                const signature = signatureForArtifacts(artifacts);
                if (lastSignatureByJobRef.current.get(jobId) === signature) return;

                const byDocNum = buildDocArtifactMap(artifacts);
                if (byDocNum.size === 0) {
                    lastSignatureByJobRef.current.set(jobId, signature);
                    return;
                }

                const currentPeople = useProfileStore.getState().people;
                let anyChanged = false;
                const nextPeople = currentPeople.map((person) => {
                    const hasJob =
                        (person.jobIds || []).includes(jobId) ||
                        (person.readings || []).some((r) => r.jobId === jobId);

                    if (!hasJob) return person;

                    const { changed, nextReadings } = applyArtifactPathsToReadings(jobId, person.readings || [], byDocNum);
                    if (!changed) return person;

                    anyChanged = true;
                    return {
                        ...person,
                        readings: nextReadings,
                        updatedAt: new Date().toISOString(),
                    };
                });

                if (anyChanged) {
                    replacePeople(nextPeople);
                }

                lastSignatureByJobRef.current.set(jobId, signature);
            } catch (error) {
                console.warn('⚠️ [RealtimeArtifactSync] syncSingleJob failed', { jobId, error });
            } finally {
                inFlightByJobRef.current.delete(jobId);
            }
        },
        [replacePeople]
    );

    const syncTrackedJobs = useCallback(async () => {
        const tracked = Array.from(trackedJobIdsRef.current);
        if (tracked.length === 0) return;
        await Promise.allSettled(tracked.map((jobId) => syncSingleJob(jobId)));
    }, [syncSingleJob]);

    useEffect(() => {
        if (!isAuthReady || !userId || !env.ENABLE_SUPABASE_LIBRARY_SYNC || !isSupabaseConfigured) {
            setIsSubscribed(false);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            return;
        }

        void syncTrackedJobs();

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channel = supabase
            .channel(`v2-job-artifacts-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'job_artifacts',
                },
                (payload) => {
                    const artifact = payload?.new as JobArtifact | undefined;
                    const jobId = artifact?.job_id;
                    if (!jobId || !trackedJobIdsRef.current.has(jobId)) return;
                    setLastEventAt(Date.now());
                    void syncSingleJob(jobId);
                }
            )
            .subscribe((status) => {
                setIsSubscribed(status === 'SUBSCRIBED');
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            setIsSubscribed(false);
        };
    }, [isAuthReady, syncSingleJob, syncTrackedJobs, userId]);

    useEffect(() => {
        if (!userId) return;

        const onAppStateChange = (nextState: AppStateStatus) => {
            if (nextState !== 'active') return;
            void syncTrackedJobs();
        };

        const sub = AppState.addEventListener('change', onAppStateChange);
        return () => sub.remove();
    }, [syncTrackedJobs, userId]);

    return {
        isSubscribed,
        trackedJobs: trackedJobIdsRef.current.size,
        lastEventAt,
        resync: syncTrackedJobs,
    };
};

export const useRealtimeArtifactSync = () => useRealtimeArtifactSyncInternal();
export const useRealtimeSubscription = () => {
    useRealtimeArtifactSyncInternal();
};
