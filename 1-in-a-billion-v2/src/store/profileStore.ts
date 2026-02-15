/**
 * PROFILE STORE
 * 
 * Stores people (user + partners/friends) and their readings.
 * Also tracks saved audio files and PDFs for the library.
 * Persisted to AsyncStorage for offline access.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export type ReadingSystem = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';

export type BirthData = {
    birthDate: string;
    birthTime: string;
    birthCity: string;
    timezone: string;
    latitude: number;
    longitude: number;
};

export type Placements = {
    sunSign: string;
    sunDegree?: string;
    moonSign: string;
    moonDegree?: string;
    risingSign: string;
    risingDegree?: string;
};

export type Reading = {
    id: string;
    system: ReadingSystem;
    content?: string;
    compatibilityScore?: number;
    conclusion?: string;
    generatedAt?: string;
    source?: 'claude' | 'deepseek' | 'gpt';
    wordCount?: number;
    note?: string;
    readingNumber?: number;
    pdfPath?: string;
    audioPath?: string;
    songPath?: string;
    jobId?: string;
    docNum?: number;
    duration?: number;
    createdAt?: string;
};

export type SavedAudio = {
    id: string;
    readingId: string;
    personId?: string;
    person1Id?: string;
    person2Id?: string;
    system: ReadingSystem;
    fileName: string;
    filePath: string;
    durationSeconds: number;
    fileSizeMB: number;
    createdAt: string;
    title: string;
};

export type SavedPDF = {
    id: string;
    readingId?: string;
    personId?: string;
    person1Id?: string;
    person2Id?: string;
    system?: ReadingSystem;
    fileName: string;
    filePath: string;
    pageCount: number;
    fileSizeMB: number;
    createdAt: string;
    title: string;
    type: 'individual' | 'compatibility' | 'complete';
};

export type HookReading = {
    type: 'sun' | 'moon' | 'rising';
    sign: string;
    intro: string;
    main: string;
    generatedAt: string;
};

export type Person = {
    id: string;
    name: string;
    isUser: boolean;
    isVerified?: boolean;
    gender?: 'male' | 'female';
    birthData: BirthData;
    placements?: Placements;
    essences?: any;
    personalContext?: string;
    hookReadings?: HookReading[];
    hookAudioPaths?: Partial<Record<HookReading['type'], string>>;
    originalPhotoUrl?: string;
    portraitUrl?: string;
    readings: Reading[];
    jobIds?: string[];
    createdAt: string;
    updatedAt: string;
};

export type CompatibilityReading = {
    id: string;
    person1Id: string;
    person2Id: string;
    system: ReadingSystem;
    content: string;
    spicyScore: number;
    safeStableScore: number;
    conclusion: string;
    generatedAt: string;
    source: 'claude' | 'deepseek' | 'gpt';
};

type ProfileState = {
    hasHydrated: boolean;
    people: Person[];
    compatibilityReadings: CompatibilityReading[];
    savedAudios: SavedAudio[];
    savedPDFs: SavedPDF[];

    addPerson: (person: Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'readings'>) => string;
    updatePerson: (id: string, updates: Partial<Person>) => void;
    upsertPersonById: (person: Person) => void;
    deletePerson: (id: string) => void;
    getPerson: (id: string) => Person | undefined;
    getUser: () => Person | undefined;
    repairPeople: () => { mergedCount: number };
    repairReadings: () => { removedCount: number };
    cleanupDuplicateUsers: () => { mergedCount: number };
    replacePeople: (people: Person[]) => void;
    setHookReadings: (personId: string, readings: HookReading[]) => void;
    getHookReadings: (personId: string) => HookReading[] | undefined;
    getAllPeopleWithHookReadings: () => Person[];
    addReading: (personId: string, reading: Omit<Reading, 'id'>) => string;
    deleteReading: (personId: string, readingId: string) => void;
    getReadings: (personId: string, system?: ReadingSystem) => Reading[];
    syncReadingArtifacts: (personId: string, readingId: string, artifacts: { pdfPath?: string; audioPath?: string; songPath?: string; duration?: number }) => void;
    createPlaceholderReadings: (personId: string, jobId: string, systems: ReadingSystem[], createdAt: string) => void;
    getReadingsByJobId: (personId: string, jobId: string) => Reading[];
    linkJobToPerson: (personId: string, jobId: string) => void;
    linkJobToPersonByName: (personName: string, jobId: string) => void;
    addCompatibilityReading: (reading: Omit<CompatibilityReading, 'id'>) => string;
    getCompatibilityReadings: (person1Id: string, person2Id: string) => CompatibilityReading[];
    replaceCompatibilityReadings: (readings: CompatibilityReading[]) => void;
    clearCompatibilityReadings: () => void;
    addSavedAudio: (audio: Omit<SavedAudio, 'id'>) => string;
    upsertSavedAudioById: (audio: SavedAudio) => void;
    deleteSavedAudio: (id: string) => void;
    getSavedAudios: () => SavedAudio[];
    getAudioForReading: (readingId: string) => SavedAudio | undefined;
    addSavedPDF: (pdf: Omit<SavedPDF, 'id'>) => string;
    deleteSavedPDF: (id: string) => void;
    getSavedPDFs: () => SavedPDF[];
    setUserVerified: (verified: boolean) => void;
    isUserVerified: () => boolean;
    getLibraryStats: () => {
        totalReadings: number;
        totalAudios: number;
        totalPDFs: number;
        totalPeople: number;
        totalCompatibility: number;
    };
    reset: () => void;
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

const hasMeaningfulBirthDate = (p: any) => {
    const bd = p?.birthData?.birthDate;
    return typeof bd === 'string' && bd.trim().length > 0;
};

const birthDateValue = (p: any) => {
    const bd = p?.birthData?.birthDate;
    return typeof bd === 'string' ? bd.trim() : '';
};

const birthCompletenessScore = (p: any) => {
    const bd = p?.birthData || {};
    let score = 0;
    if (typeof bd.birthDate === 'string' && bd.birthDate.trim()) score += 3;
    if (typeof bd.birthTime === 'string' && bd.birthTime.trim()) score += 2;
    if (typeof bd.birthCity === 'string' && bd.birthCity.trim()) score += 1;
    if (typeof bd.timezone === 'string' && bd.timezone.trim()) score += 1;
    if (typeof bd.latitude === 'number' && Number.isFinite(bd.latitude) && Math.abs(bd.latitude) > 0) score += 1;
    if (typeof bd.longitude === 'number' && Number.isFinite(bd.longitude) && Math.abs(bd.longitude) > 0) score += 1;
    return score;
};

const sanitizeBirthData = (p: any, existingBirthData?: BirthData): BirthData => {
    const bd = p?.birthData || {};
    const existing: Partial<BirthData> = existingBirthData || {};
    return {
        birthDate: (typeof bd.birthDate === 'string' && bd.birthDate) || existing.birthDate || '',
        birthTime: (typeof bd.birthTime === 'string' && bd.birthTime) || existing.birthTime || '',
        birthCity: (typeof bd.birthCity === 'string' && bd.birthCity) || existing.birthCity || '',
        timezone: (typeof bd.timezone === 'string' && bd.timezone) || existing.timezone || '',
        latitude: (typeof bd.latitude === 'number' && Number.isFinite(bd.latitude)) ? bd.latitude : (existing.latitude || 0),
        longitude: (typeof bd.longitude === 'number' && Number.isFinite(bd.longitude)) ? bd.longitude : (existing.longitude || 0),
    };
};

const mergePeople = (a: any, b: any): Person => {
    const aHasBD = hasMeaningfulBirthDate(a);
    const bHasBD = hasMeaningfulBirthDate(b);
    let base = a;
    let other = b;
    if (aHasBD && !bHasBD) {
        base = a; other = b;
    } else if (bHasBD && !aHasBD) {
        base = b; other = a;
    } else {
        const aScore = birthCompletenessScore(a) + (Array.isArray(a?.readings) ? a.readings.length : 0);
        const bScore = birthCompletenessScore(b) + (Array.isArray(b?.readings) ? b.readings.length : 0);
        base = aScore >= bScore ? a : b;
        other = base === a ? b : a;
    }

    const baseBirth = sanitizeBirthData(base);
    const otherBirth = sanitizeBirthData(other);
    const mergedBirth = birthCompletenessScore({ birthData: otherBirth }) > birthCompletenessScore({ birthData: baseBirth }) ? otherBirth : baseBirth;

    return {
        ...other,
        ...base,
        id: base.id,
        birthData: mergedBirth,
        readings: [
            ...(Array.isArray(base?.readings) ? base.readings : []),
            ...(Array.isArray(other?.readings) ? other.readings : []),
        ],
        updatedAt: new Date().toISOString(),
    } as Person;
};

const dedupePeopleState = (state: any) => {
    const people: any[] = Array.isArray(state?.people) ? state.people : [];
    if (people.length <= 1) return { nextState: state, mergedCount: 0, idMap: {} };

    const idMap: Record<string, string> = {};
    const survivors: any[] = [];
    let mergedCount = 0;

    const groups = new Map<string, any[]>();
    groups.set('user', people.filter(p => p.isUser));
    for (const p of people.filter(p => !p.isUser)) {
        const key = norm(p.name);
        const arr = groups.get(key) || [];
        arr.push(p);
        groups.set(key, arr);
    }

    for (const [key, group] of groups) {
        if (group.length === 1) {
            survivors.push(group[0]);
            continue;
        }
        let merged = group[0];
        for (let i = 1; i < group.length; i++) {
            const next = group[i];
            const beforeId = next.id;
            merged = mergePeople(merged, next);
            idMap[beforeId] = merged.id;
            mergedCount++;
        }
        survivors.push(merged);
    }

    return { nextState: { ...state, people: survivors }, mergedCount, idMap };
};

const dedupeReadingsForPerson = (readings: any[]) => {
    const bySig = new Map<string, any>();
    for (const r of readings) {
        const sig = `${r.system}|${r.wordCount}|${String(r.content || '').slice(0, 100)}`;
        if (!bySig.has(sig)) bySig.set(sig, r);
    }
    const kept = Array.from(bySig.values());
    return { next: kept, removed: readings.length - kept.length };
};

const initialState = {
    hasHydrated: false,
    people: [] as Person[],
    compatibilityReadings: [] as CompatibilityReading[],
    savedAudios: [] as SavedAudio[],
    savedPDFs: [] as SavedPDF[],
};

export const useProfileStore = create<ProfileState>()(
    persist(
        (set, get) => ({
            ...initialState,

            // People Actions
            addPerson: (personData) => {
                if (personData?.isUser === true) {
                    const existingUser = get().people.find((p) => p.isUser);
                    if (existingUser) {
                        set((state) => ({
                            people: state.people.map((p) => (p.id === existingUser.id ? mergePeople(existingUser, personData) : p)),
                        })); return existingUser.id;
                    }
                }
                const id = generateId();
                const now = new Date().toISOString();
                const person: Person = {
                    ...personData,
                    id,
                    readings: [],
                    createdAt: now,
                    updatedAt: now,
                    birthData: sanitizeBirthData(personData),
                };
                set((state) => ({ people: [...state.people, person] }));
                return id;
            },

            updatePerson: (id, updates) => {
                set((state) => ({
                    people: state.people.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p)),
                }));
            },

            upsertPersonById: (incoming) => {
                if (!incoming?.id) return;
                set((state) => {
                    const idx = state.people.findIndex((p) => p.id === incoming.id);
                    if (idx < 0) {
                        const now = new Date().toISOString();
                        return { people: [...state.people, { ...incoming, createdAt: incoming.createdAt || now, updatedAt: incoming.updatedAt || now }] };
                    }
                    const next = [...state.people];
                    next[idx] = { ...next[idx], ...incoming, updatedAt: new Date().toISOString() };
                    return { people: next };
                });
            },

            deletePerson: (id) => {
                const person = get().people.find((p) => p.id === id);
                if (person?.isUser) return;
                set((state) => ({
                    people: state.people.filter((p) => p.id !== id),
                }));
            },

            getPerson: (id) => get().people.find((p) => p.id === id),
            getUser: () => get().people.find((p) => p.isUser),

            repairPeople: () => {
                const { nextState, mergedCount } = dedupePeopleState(get());
                set(nextState);
                return { mergedCount };
            },

            repairReadings: () => {
                let removedCount = 0;
                set((state) => ({
                    people: state.people.map((p) => {
                        const { next, removed } = dedupeReadingsForPerson(p.readings || []);
                        removedCount += removed;
                        return { ...p, readings: next };
                    }),
                }));
                return { removedCount };
            },

            cleanupDuplicateUsers: () => {
                const users = get().people.filter(p => p.isUser);
                if (users.length <= 1) return { mergedCount: 0 };
                let merged = users[0];
                for (let i = 1; i < users.length; i++) merged = mergePeople(merged, users[i]);
                const idMap: Record<string, string> = {};
                for (const u of users) if (u.id !== merged.id) idMap[u.id] = merged.id;
                set((state) => ({
                    people: [merged, ...state.people.filter(p => !p.isUser)],
                }));
                return { mergedCount: users.length - 1 };
            },

            replacePeople: (people) => set({ people }),

            setHookReadings: (personId, readings) => {
                set((state) => ({
                    people: state.people.map((p) => (p.id === personId ? { ...p, hookReadings: readings, updatedAt: new Date().toISOString() } : p)),
                }));
            },

            getHookReadings: (personId) => get().people.find((p) => p.id === personId)?.hookReadings,
            getAllPeopleWithHookReadings: () => get().people.filter((p) => p.hookReadings && p.hookReadings.length > 0),

            // Reading Actions
            addReading: (personId, readingData) => {
                const id = generateId();
                const reading: Reading = { ...readingData, id };
                set((state) => ({
                    people: state.people.map((p) => (p.id === personId ? { ...p, readings: [...p.readings, reading], updatedAt: new Date().toISOString() } : p)),
                }));
                return id;
            },

            deleteReading: (personId, readingId) => {
                set((state) => ({
                    people: state.people.map((p) => (p.id === personId ? { ...p, readings: p.readings.filter((r) => r.id !== readingId), updatedAt: new Date().toISOString() } : p)),
                }));
            },

            getReadings: (personId, system) => {
                const p = get().people.find((p) => p.id === personId);
                if (!p) return [];
                return system ? p.readings.filter((r) => r.system === system) : p.readings;
            },

            syncReadingArtifacts: (personId, readingId, artifacts) => {
                set((state) => ({
                    people: state.people.map((p) => (p.id === personId ? { ...p, readings: p.readings.map((r) => (r.id === readingId ? { ...r, ...artifacts } : r)), updatedAt: new Date().toISOString() } : p)),
                }));
            },

            createPlaceholderReadings: (personId, jobId, systems, createdAt) => {
                const placeholderReadings: Reading[] = systems.map((system, index) => ({
                    id: generateId(),
                    system,
                    content: '',
                    generatedAt: createdAt,
                    jobId,
                    docNum: index + 1,
                    createdAt,
                    note: 'Processing...',
                }));
                set((state) => ({
                    people: state.people.map((p) => (p.id === personId ? { ...p, readings: [...p.readings, ...placeholderReadings], jobIds: Array.from(new Set([...(p.jobIds || []), jobId])), updatedAt: new Date().toISOString() } : p)),
                }));
            },

            getReadingsByJobId: (personId, jobId) => get().people.find((p) => p.id === personId)?.readings.filter((r) => r.jobId === jobId) || [],

            linkJobToPerson: (personId, jobId) => {
                set((state) => ({
                    people: state.people.map((p) => (p.id === personId ? { ...p, jobIds: Array.from(new Set([...(p.jobIds || []), jobId])), updatedAt: new Date().toISOString() } : p)),
                }));
            },

            linkJobToPersonByName: (personName, jobId) => {
                const p = get().people.find((p) => p.name === personName);
                if (p) get().linkJobToPerson(p.id, jobId);
            },

            // Compatibility Actions
            addCompatibilityReading: (readingData) => {
                const id = generateId();
                const reading: CompatibilityReading = { ...readingData, id };
                set((state) => ({
                    compatibilityReadings: [...state.compatibilityReadings, reading],
                }));
                return id;
            },

            getCompatibilityReadings: (person1Id, person2Id) => {
                return get().compatibilityReadings.filter(
                    (r) =>
                        (r.person1Id === person1Id && r.person2Id === person2Id) ||
                        (r.person1Id === person2Id && r.person2Id === person1Id)
                );
            },

            replaceCompatibilityReadings: (readings) => {
                set({ compatibilityReadings: Array.isArray(readings) ? readings : [] });
            },

            clearCompatibilityReadings: () => {
                set({ compatibilityReadings: [] });
            },

            // Audio Actions
            addSavedAudio: (audioData) => {
                const id = generateId();
                const audio: SavedAudio = { ...audioData, id };
                set((state) => ({ savedAudios: [...state.savedAudios, audio] }));
                return id;
            },

            upsertSavedAudioById: (audio) => {
                set((state) => {
                    const idx = state.savedAudios.findIndex((a) => a.id === audio.id);
                    if (idx >= 0) {
                        const next = [...state.savedAudios];
                        next[idx] = audio;
                        return { savedAudios: next };
                    }
                    return { savedAudios: [...state.savedAudios, audio] };
                });
            },

            deleteSavedAudio: (id) => set((state) => ({ savedAudios: state.savedAudios.filter((a) => a.id !== id) })),
            getSavedAudios: () => get().savedAudios,
            getAudioForReading: (readingId) => get().savedAudios.find((a) => a.readingId === readingId),

            // PDF Actions
            addSavedPDF: (pdfData) => {
                const id = generateId();
                const pdf: SavedPDF = { ...pdfData, id };
                set((state) => ({ savedPDFs: [...state.savedPDFs, pdf] }));
                return id;
            },

            deleteSavedPDF: (id) => set((state) => ({ savedPDFs: state.savedPDFs.filter((p) => p.id !== id) })),
            getSavedPDFs: () => get().savedPDFs,

            // KYC Actions
            setUserVerified: (verified) => {
                set((state) => ({
                    people: state.people.map((p) => p.isUser ? { ...p, isVerified: verified, updatedAt: new Date().toISOString() } : p),
                }));
            },

            isUserVerified: () => get().people.find((p) => p.isUser)?.isVerified ?? false,

            // Library Stats
            getLibraryStats: () => {
                const state = get();
                return {
                    totalReadings: state.people.reduce((acc, p) => acc + p.readings.length, 0),
                    totalAudios: state.savedAudios.length,
                    totalPDFs: state.savedPDFs.length,
                    totalPeople: state.people.filter((p) => !p.isUser).length,
                    totalCompatibility: state.compatibilityReadings.length,
                };
            },

            reset: () => set(initialState),
        }),
        {
            name: 'profile-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 6,
            onRehydrateStorage: () => (state) => {
                if (state) state.hasHydrated = true;
            },
            migrate: (persisted: any, version) => {
                if (version < 6) {
                    // Basic migration if needed, but version 6 is current.
                }
                return persisted;
            },
        }
    )
);
