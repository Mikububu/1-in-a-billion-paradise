import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CityOption, HookReading, LanguageOption } from '@/types/forms';
import { ProfileSnapshot } from '@/types/api';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);



// ═══════════════════════════════════════════════════════════════════════════
// PEOPLE LIBRARY - Store unlimited people for readings
// ═══════════════════════════════════════════════════════════════════════════

export type PersonProfile = {
    id: string;
    name: string;
    birthDate: string;
    birthTime: string;
    birthCity: CityOption;
    avatar?: string; // Optional avatar image base64
    isMainUser: boolean; // true = app owner, false = 3rd party
    createdAt: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// READINGS LIBRARY - All generated readings (singles & overlays)
// ═══════════════════════════════════════════════════════════════════════════

export type ReadingSystem = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';
export type ReadingBundle = 'complete' | 'bundle_16_readings'; // Multi-system bundles

export type ReadingRecord = {
    id: string;

    // Who is this reading for?
    type: 'single' | 'overlay';
    personIds: string[]; // [personId] for single, [person1Id, person2Id] for overlay

    // What system(s)?
    system: ReadingSystem | ReadingBundle;
    systems?: ReadingSystem[]; // For bundles: which systems are included

    // Content
    title: string; // "Michael's Vedic Reading" or "Michael & Charmaine Overlay"
    text: string;
    summary?: string; // Short summary for dashboard preview
    verdict?: 'GO' | 'CONDITIONAL' | 'NO_GO'; // For overlays
    conditions?: string; // If CONDITIONAL, what are the conditions?
    compatibilityScore?: number; // For overlays (0-100)

    // Media
    audioPath?: string; // Local/remote playable source path
    audioBase64?: string; // Legacy field; avoid new writes
    audioDuration?: number; // seconds
    pdfPath?: string; // Local file path to generated PDF

    // Chapters (for long-form readings like Bundle 16 Readings)
    chapters?: {
        id: string;
        title: string;
        system: ReadingSystem;
        startTime: number; // seconds into audio
        endTime: number;
        textStart: number; // character index in text
        textEnd: number;
    }[];

    // Metadata
    createdAt: string;
    wordCount?: number;
    status: 'generating' | 'ready' | 'error';
    errorMessage?: string;
};





type OnboardingState = {

    birthDate?: string;
    birthTime?: string;
    birthCity?: CityOption;
    currentCity?: CityOption;
    primaryLanguage?: LanguageOption;
    secondaryLanguage?: LanguageOption;
    languageImportance: number;
    relationshipPreferenceScale: number;
    name?: string;
    hookReadings: Partial<Record<HookReading['type'], HookReading>>;
    hookAudio: Partial<Record<HookReading['type'], string>>; // Playable source (storage path or URL)
    // Partner audio (3rd-person): playable source (storage path or URL)
    partnerAudio: Partial<Record<HookReading['type'], string>>;
    voiceId: string; // Voice ID from backend API (e.g., 'david', 'elisabeth', 'michael', 'peter', 'victor')

    // ═══════════════════════════════════════════════════════════════════════════
    // NEW: People & Readings Library
    // ═══════════════════════════════════════════════════════════════════════════
    people: PersonProfile[]; // All saved people (including main user)
    readings: ReadingRecord[]; // All generated readings

    hasCompletedOnboarding: boolean;
    hasPassedLanguages: boolean;
    _hasHydrated: boolean;

    // Inactivity tracking - timestamp of last user activity
    lastActiveTimestamp: number | null;

    // Onboarding setters

    setBirthDate: (date: string) => void;
    setBirthTime: (time: string) => void;
    setBirthCity: (city: CityOption) => void;
    setCurrentCity: (city?: CityOption) => void;
    setPrimaryLanguage: (language: LanguageOption) => void;
    setSecondaryLanguage: (language?: LanguageOption) => void;
    setLanguageImportance: (value: number) => void;
    setRelationshipPreferenceScale: (value: number) => void;
    setName: (name: string) => void;
    setHookReading: (reading: HookReading) => void;
    setHookAudio: (type: HookReading['type'], audioSource: string) => void;
    setPartnerAudio: (type: HookReading['type'], audioSource: string) => void;
    clearPartnerAudio: () => void;
    setVoiceId: (voiceId: string) => void;
    redirectAfterOnboarding: string | null;
    setRedirectAfterOnboarding: (screen: string | null) => void;
    showDashboard: boolean; // Flag to switch from OnboardingNavigator to MainNavigator
    setShowDashboard: (show: boolean) => void;
    setLastActiveTimestamp: (timestamp: number | null) => void;
    updateLastActive: () => void; // Convenience method to set current time

    // ═══════════════════════════════════════════════════════════════════════════
    // People Management
    // ═══════════════════════════════════════════════════════════════════════════
    addPerson: (person: Omit<PersonProfile, 'id' | 'createdAt'>) => string; // Returns new ID
    updatePerson: (id: string, updates: Partial<PersonProfile>) => void;
    deletePerson: (id: string) => void;
    getPersonById: (id: string) => PersonProfile | undefined;
    getMainUser: () => PersonProfile | undefined;

    // ═══════════════════════════════════════════════════════════════════════════
    // Readings Management  
    // ═══════════════════════════════════════════════════════════════════════════
    addReading: (reading: Omit<ReadingRecord, 'id' | 'createdAt'>) => string; // Returns new ID
    updateReading: (id: string, updates: Partial<ReadingRecord>) => void;
    deleteReading: (id: string) => void;
    getReadingById: (id: string) => ReadingRecord | undefined;
    getReadingsForPerson: (personId: string) => ReadingRecord[];
    getOverlayReadings: (person1Id: string, person2Id: string) => ReadingRecord[];

    setHasCompletedOnboarding: (value: boolean) => void;
    setHasPassedLanguages: (value: boolean) => void;
    completeOnboarding: () => void;
    reset: () => void;
};

// Clean initial state - language must be explicitly chosen in Languages screen
const baseState = {

    birthDate: undefined as string | undefined,
    birthTime: undefined as string | undefined,
    birthCity: undefined as CityOption | undefined,
    currentCity: undefined as CityOption | undefined,
    primaryLanguage: undefined as LanguageOption | undefined,
    secondaryLanguage: undefined as LanguageOption | undefined,
    languageImportance: 5,
    relationshipPreferenceScale: 5,
    hookReadings: {} as Partial<Record<HookReading['type'], HookReading>>,
    hookAudio: {} as Partial<Record<HookReading['type'], string>>,
    partnerAudio: {} as Partial<Record<HookReading['type'], string>>,
    voiceId: 'david',
    // New People & Readings Library
    people: [] as PersonProfile[],
    readings: [] as ReadingRecord[],
    hasCompletedOnboarding: false,
    hasPassedLanguages: false,
    redirectAfterOnboarding: null,
    showDashboard: false, // Default: show Intro (OnboardingNavigator)
    lastActiveTimestamp: null, // Track last activity for inactivity-based routing
    _hasHydrated: false,
};

export const useOnboardingStore = create<OnboardingState>()(
    persist(
        (set, get) => ({
            ...baseState,

            setBirthDate: (birthDate) => set({ birthDate }),
            setBirthTime: (birthTime) => set({ birthTime }),
            setBirthCity: (birthCity) => set({ birthCity }),
            setCurrentCity: (currentCity) => set({ currentCity }),
            setPrimaryLanguage: (primaryLanguage) => set({ primaryLanguage }),
            setSecondaryLanguage: (secondaryLanguage) => set({ secondaryLanguage }),
            setLanguageImportance: (languageImportance) => set({ languageImportance }),
            setRelationshipPreferenceScale: (relationshipPreferenceScale) => set({ relationshipPreferenceScale }),
            setName: (name) => set({ name }),
            setHookReading: (reading) =>
                set((state) => ({
                    hookReadings: { ...state.hookReadings, [reading.type]: reading },
                })),
            setHookAudio: (type, audioSource) => {
                set((state) => {
                    const newHookAudio = { ...state.hookAudio, [type]: audioSource };
                    return { hookAudio: newHookAudio };
                });
            },
            setPartnerAudio: (type, audioSource) =>
                set((state) => ({
                    partnerAudio: {
                        ...state.partnerAudio,
                        [type]: audioSource,
                    },
                })),
            clearPartnerAudio: () => set({ partnerAudio: {} }),
            setVoiceId: (voiceId) => set({ voiceId }),
            setRedirectAfterOnboarding: (redirectAfterOnboarding) => set({ redirectAfterOnboarding }),
            setShowDashboard: (showDashboard) => {
                console.log('🎯 setShowDashboard called with:', showDashboard, new Error().stack?.split('\n').slice(1, 4).join(' <- '));
                set({ showDashboard });
            },
            setLastActiveTimestamp: (lastActiveTimestamp) => set({ lastActiveTimestamp }),
            updateLastActive: () => set({ lastActiveTimestamp: Date.now() }),

            // ═══════════════════════════════════════════════════════════════════════════
            // People Management Actions
            // ═══════════════════════════════════════════════════════════════════════════
            addPerson: (personData) => {
                const id = generateId();
                const person: PersonProfile = {
                    ...personData,
                    id,
                    createdAt: new Date().toISOString(),
                };
                set((state) => ({ people: [...state.people, person] }));
                return id;
            },

            updatePerson: (id, updates) =>
                set((state) => ({
                    people: state.people.map((p) => (p.id === id ? { ...p, ...updates } : p)),
                })),

            deletePerson: (id) =>
                set((state) => ({
                    people: state.people.filter((p) => p.id !== id),
                    // Also remove readings that only involve this person
                    readings: state.readings.filter((r) => !r.personIds.every((pid) => pid === id)),
                })),

            getPersonById: (id) => {
                return get().people.find((p) => p.id === id);
            },

            getMainUser: () => {
                return get().people.find((p) => p.isMainUser);
            },

            // ═══════════════════════════════════════════════════════════════════════════
            // Readings Management Actions
            // ═══════════════════════════════════════════════════════════════════════════
            addReading: (readingData) => {
                const id = generateId();
                const reading: ReadingRecord = {
                    ...readingData,
                    id,
                    createdAt: new Date().toISOString(),
                };
                set((state) => ({ readings: [...state.readings, reading] }));
                return id;
            },

            updateReading: (id, updates) =>
                set((state) => ({
                    readings: state.readings.map((r) => (r.id === id ? { ...r, ...updates } : r)),
                })),

            deleteReading: (id) =>
                set((state) => ({
                    readings: state.readings.filter((r) => r.id !== id),
                })),

            getReadingById: (id) => {
                return get().readings.find((r) => r.id === id);
            },

            getReadingsForPerson: (personId) => {
                return get().readings.filter(
                    (r) => r.type === 'single' && r.personIds.includes(personId)
                );
            },

            getOverlayReadings: (person1Id, person2Id) => {
                return get().readings.filter(
                    (r) =>
                        r.type === 'overlay' &&
                        r.personIds.includes(person1Id) &&
                        r.personIds.includes(person2Id)
                );
            },

            setHasCompletedOnboarding: (hasCompletedOnboarding) =>
                set({
                    hasCompletedOnboarding,
                    // NOTE: Do NOT auto-set showDashboard here.
                    // Per ARCHITECTURE.md: showDashboard should only be set by user action
                    // (tapping "My Secret Life" on IntroScreen or completing onboarding flow)
                }),
            setHasPassedLanguages: (hasPassedLanguages) => set({ hasPassedLanguages }),
            completeOnboarding: () =>
                set({
                    hasCompletedOnboarding: true,
                    // Switch RootNavigator to MainNavigator immediately to avoid loops.
                    showDashboard: true,
                }),
            reset: () => set({ ...baseState }),
        }),
        {
            name: 'onboarding-storage', // Storage key
            storage: createJSONStorage(() => AsyncStorage),
            version: 9, // Current V2 schema
            migrate: (persistedState: any, version) => {

                if (version < 3) {
                    // Reset all data to clean state
                    return { ...baseState } as any;
                }
                if (version < 4) {
                    // Ensure primary language must be explicitly selected (do not silently default to English).
                    if (persistedState && typeof persistedState === 'object') {
                        const pl = persistedState.primaryLanguage;
                        const isImplicitEnglish =
                            pl && typeof pl === 'object' && pl.code === 'en' && (pl.label === 'English' || !pl.label);
                        if (!pl || isImplicitEnglish) {
                            return { ...persistedState, primaryLanguage: undefined } as any;
                        }
                    }
                }
                if (version < 5) {
                    // Add showDashboard flag (defaults to false - show Intro)
                    if (persistedState && typeof persistedState === 'object') {
                        persistedState.showDashboard = false;
                    }
                }
                if (version < 8) {
                    if (persistedState && typeof persistedState === 'object') {
                        const hasHooks = Boolean(
                            persistedState?.hookReadings?.sun ||
                            persistedState?.hookReadings?.moon ||
                            persistedState?.hookReadings?.rising
                        );
                        persistedState.hasPassedLanguages = Boolean(
                            persistedState?.hasPassedLanguages ||
                            hasHooks ||
                            persistedState?.hasCompletedOnboarding
                        );
                    }
                }
                if (version < 9) {
                    // Migrate from version 8 to 9: preserve showDashboard state
                    if (persistedState && typeof persistedState === 'object') {
                        // showDashboard is now persisted, so preserve it from old state or default to false
                        if (!('showDashboard' in persistedState)) {
                            persistedState.showDashboard = false;
                        }
                    }
                }
                return persistedState;
            },
            // Persist everything except functions
            partialize: (state) => ({

                birthDate: state.birthDate,
                birthTime: state.birthTime,
                birthCity: state.birthCity,
                currentCity: state.currentCity,
                primaryLanguage: state.primaryLanguage,
                secondaryLanguage: state.secondaryLanguage,
                languageImportance: state.languageImportance,
                relationshipPreferenceScale: state.relationshipPreferenceScale,
                name: state.name,
                hookReadings: state.hookReadings,
                hookAudio: state.hookAudio, // Persist resolved audio sources
                partnerAudio: state.partnerAudio, // Persist partner audio sources
                voiceId: state.voiceId,
                // New People & Readings Library
                people: state.people, // All saved people profiles
                readings: state.readings, // All generated readings with audio/PDF paths
                hasCompletedOnboarding: state.hasCompletedOnboarding,
                hasPassedLanguages: state.hasPassedLanguages,
                redirectAfterOnboarding: state.redirectAfterOnboarding,
                showDashboard: state.showDashboard,
                lastActiveTimestamp: state.lastActiveTimestamp, // Persist for inactivity tracking
                _hasHydrated: state._hasHydrated,
            } as any),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state._hasHydrated = true;
                    // NOTE: showDashboard is NOW persisted (as of version 9)
                    // It will be restored from storage on app rehydration
                    // The 24h inactivity reset is handled by AppState listener in RootNavigator
                }
            },
        }
    )
);

export const buildProfileSnapshot = (state: OnboardingState): ProfileSnapshot | undefined => {
    if (!state.birthDate || !state.birthTime || !state.birthCity || !state.primaryLanguage) {
        return undefined;
    }

    return {
        birthDate: state.birthDate,
        birthTime: state.birthTime,
        timezone: state.birthCity.timezone,
        latitude: state.birthCity.latitude,
        longitude: state.birthCity.longitude,
        relationshipPreferenceScale: state.relationshipPreferenceScale,
        primaryLanguage: state.primaryLanguage.code,
        secondaryLanguage: state.secondaryLanguage?.code,
        languageImportance: state.languageImportance,
        currentCity: state.currentCity,
    };
};

// DEPRECATED - causes infinite loops. Use individual selectors.
export const useProfileSnapshot = () => {
  throw new Error('useProfileSnapshot is deprecated. Use buildProfileSnapshot() or individual selectors instead.');
};
