/**
 * LIBRARY RECOVERY SERVICE
 *
 * Rebuilds local reading placeholders from backend job data.
 * This handles the case where local AsyncStorage was cleared
 * (store reset, new device, cache eviction) but jobs still exist
 * in Supabase. Without recovery, the Soul Library shows 0 readings
 * even though the user has completed readings.
 */

import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { useProfileStore, type ReadingSystem } from '@/store/profileStore';

type BackendJob = {
    id: string;
    status: string;
    type: string;
    createdAt: string;
    completedAt?: string;
    systems: string[];
    params: {
        person1?: { id: string; name: string };
        person2?: { id: string; name: string };
        systems?: string[];
    };
};

const VALID_SYSTEMS: ReadingSystem[] = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];

function normalizeSystem(raw: string): ReadingSystem {
    const lower = raw.toLowerCase().trim();
    if (VALID_SYSTEMS.includes(lower as ReadingSystem)) return lower as ReadingSystem;
    return 'western';
}

/**
 * Fetches user's jobs from backend and rebuilds any missing reading
 * placeholders in the local profile store.
 *
 * Returns the number of readings recovered.
 */
export async function recoverReadingsFromCloud(userId: string): Promise<{ recovered: number; error?: string }> {
    if (!isSupabaseConfigured || !userId) {
        return { recovered: 0, error: 'Not configured' };
    }

    let accessToken: string | undefined;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token;
    } catch {
        return { recovered: 0, error: 'No session' };
    }

    if (!accessToken) {
        return { recovered: 0, error: 'No access token' };
    }

    // Fetch user's jobs from backend
    let jobs: BackendJob[] = [];
    try {
        const url = `${env.CORE_API_URL}/api/jobs/v2/user/${userId}/jobs`;
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            return { recovered: 0, error: `HTTP ${response.status}` };
        }
        const data = await response.json();
        jobs = data?.jobs || [];
    } catch (err: any) {
        return { recovered: 0, error: err?.message || 'Fetch failed' };
    }

    if (jobs.length === 0) {
        return { recovered: 0 };
    }

    const store = useProfileStore.getState();
    const people = store.people;
    let recovered = 0;

    for (const job of jobs) {
        // Only recover completed or in-progress jobs
        if (job.status !== 'complete' && job.status !== 'completed' && job.status !== 'processing') continue;

        const systems = (job.params?.systems || job.systems || []).map(normalizeSystem);
        if (systems.length === 0) continue;

        const person1Id = job.params?.person1?.id;
        const person1Name = job.params?.person1?.name;
        const person2Id = job.params?.person2?.id;
        const person2Name = job.params?.person2?.name;
        const isSynastry = job.type === 'synastry';
        const createdAt = job.createdAt || new Date().toISOString();

        // Find the person in local store
        const findPerson = (id?: string, name?: string) => {
            if (id) {
                const byId = people.find((p) => p.id === id);
                if (byId) return byId;
            }
            if (name) {
                return people.find((p) => p.name === name);
            }
            return undefined;
        };

        const person1 = findPerson(person1Id, person1Name);
        if (!person1) continue;

        // Check if this job already has readings attached
        const existingReadings = (person1.readings || []).filter((r) => r.jobId === job.id);
        if (existingReadings.length > 0) continue;

        // Create placeholder readings for person1
        if (isSynastry) {
            // Synastry: overlay readings on person1
            store.createPlaceholderReadings(
                person1.id,
                job.id,
                systems,
                createdAt,
                'overlay',
                person2Name || 'Partner'
            );
        } else {
            // Individual reading
            store.createPlaceholderReadings(
                person1.id,
                job.id,
                systems,
                createdAt,
                'individual'
            );
        }

        recovered += systems.length;

        // For synastry, also create individual readings on person2 if they exist
        if (isSynastry && person2Id) {
            const person2 = findPerson(person2Id, person2Name);
            if (person2) {
                const p2Existing = (person2.readings || []).filter((r) => r.jobId === job.id);
                if (p2Existing.length === 0) {
                    store.createPlaceholderReadings(
                        person2.id,
                        job.id,
                        systems,
                        createdAt,
                        'individual'
                    );
                    recovered += systems.length;
                }
            }
        }
    }

    if (recovered > 0) {
        console.log(`🔄 Library recovery: restored ${recovered} reading placeholders from ${jobs.length} cloud jobs`);
    }

    return { recovered };
}
