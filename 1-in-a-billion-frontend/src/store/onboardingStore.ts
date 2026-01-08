import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CityOption, HookReading, LanguageOption, RelationshipMode } from '@/types/forms';
import { ProfileSnapshot } from '@/types/api';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to migrate legacy gender preference
const migrateGenderPreference = (pref: string | number): number => {
  if (typeof pref === 'number') return pref;
  if (pref === 'men') return 0;
  if (pref === 'women') return 100;
  return 50;
};

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
export type ReadingBundle = 'complete' | 'nuclear'; // Multi-system bundles

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
  audioPath?: string; // Local file path (better than base64 for large files)
  audioBase64?: string; // Fallback for smaller audio
  audioDuration?: number; // seconds
  pdfPath?: string; // Local file path to generated PDF

  // Chapters (for long-form readings like Nuclear Package)
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
  intensity?: number; // User's intensity preference when generated (1-10)
  status: 'generating' | 'ready' | 'error';
  errorMessage?: string;
};



// Gender preference as continuous 0-100 scale (0 = men only, 50 = both, 100 = women only)
export type GenderPreference = number;

type OnboardingState = {
  relationshipIntensity: number;
  genderPreference: GenderPreference;
  relationshipMode: RelationshipMode;
  birthDate?: string;
  birthTime?: string;
  birthCity?: CityOption;
  currentCity?: CityOption;
  primaryLanguage?: LanguageOption;
  secondaryLanguage?: LanguageOption;
  languageImportance: number;
  name?: string;
  hookReadings: Partial<Record<HookReading['type'], HookReading>>;
  hookAudio: Partial<Record<HookReading['type'], string>>; // Pre-loaded audio URLs (from Supabase Storage) or legacy Base64/file paths
  // Partner audio (for 3rd person readings - legacy, kept for backwards compat)
  partnerAudio: Partial<Record<HookReading['type'], string>>;
  voiceId: string; // 'Grandpa' | 'Anabella' | 'Dorothy' | 'Ludwig'

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: People & Readings Library
  // ═══════════════════════════════════════════════════════════════════════════
  people: PersonProfile[]; // All saved people (including main user)
  readings: ReadingRecord[]; // All generated readings

  hasCompletedOnboarding: boolean;
  _hasHydrated: boolean;

  // Onboarding setters
  setRelationshipIntensity: (value: number) => void;
  setGenderPreference: (pref: GenderPreference) => void;
  setRelationshipMode: (mode: RelationshipMode) => void;
  setBirthDate: (date: string) => void;
  setBirthTime: (time: string) => void;
  setBirthCity: (city: CityOption) => void;
  setCurrentCity: (city?: CityOption) => void;
  setPrimaryLanguage: (language: LanguageOption) => void;
  setSecondaryLanguage: (language?: LanguageOption) => void;
  setLanguageImportance: (value: number) => void;
  setName: (name: string) => void;
  setHookReading: (reading: HookReading) => void;
  setHookAudio: (type: HookReading['type'], audioBase64: string) => void;
  setPartnerAudio: (type: HookReading['type'], audioBase64: string) => void;
  clearPartnerAudio: () => void;
  setVoiceId: (voiceId: string) => void;
  redirectAfterOnboarding: string | null;
  setRedirectAfterOnboarding: (screen: string | null) => void;
  showDashboard: boolean; // Flag to switch from OnboardingNavigator to MainNavigator
  setShowDashboard: (show: boolean) => void;

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
  completeOnboarding: () => void;
  reset: () => void;
};

// Clean initial state - language must be explicitly chosen in Languages screen
const baseState = {
  relationshipIntensity: 5,
  genderPreference: 50 as GenderPreference, // 0=men, 50=both, 100=women
  relationshipMode: 'sensual' as RelationshipMode,
  birthDate: undefined as string | undefined,
  birthTime: undefined as string | undefined,
  birthCity: undefined as CityOption | undefined,
  currentCity: undefined as CityOption | undefined,
  primaryLanguage: undefined as LanguageOption | undefined,
  secondaryLanguage: undefined as LanguageOption | undefined,
  languageImportance: 5,
  hookReadings: {} as Partial<Record<HookReading['type'], HookReading>>,
  hookAudio: {} as Partial<Record<HookReading['type'], string>>,
  partnerAudio: {} as Partial<Record<HookReading['type'], string>>,
  voiceId: 'Grandpa',
  // New People & Readings Library
  people: [] as PersonProfile[],
  readings: [] as ReadingRecord[],
  hasCompletedOnboarding: false,
  redirectAfterOnboarding: null,
  showDashboard: false, // Default: show Intro (OnboardingNavigator)
  _hasHydrated: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...baseState,
      setRelationshipIntensity: (relationshipIntensity) => set({ relationshipIntensity }),
      setGenderPreference: (genderPreference) => set({ genderPreference }),
      setRelationshipMode: (relationshipMode) => set({ relationshipMode }),
      setBirthDate: (birthDate) => set({ birthDate }),
      setBirthTime: (birthTime) => set({ birthTime }),
      setBirthCity: (birthCity) => set({ birthCity }),
      setCurrentCity: (currentCity) => set({ currentCity }),
      setPrimaryLanguage: (primaryLanguage) => set({ primaryLanguage }),
      setSecondaryLanguage: (secondaryLanguage) => set({ secondaryLanguage }),
      setLanguageImportance: (languageImportance) => set({ languageImportance }),
      setName: (name) => set({ name }),
      setHookReading: (reading) =>
        set((state) => ({
          hookReadings: { ...state.hookReadings, [reading.type]: reading },
        })),
      setHookAudio: (type, audioBase64) => {
        set((state) => {
          const newHookAudio = { ...state.hookAudio, [type]: audioBase64 };
          return { hookAudio: newHookAudio };
        });
      },
      setPartnerAudio: (type, audioBase64) =>
        set((state) => ({
          partnerAudio: {
            ...state.partnerAudio,
            [type]: audioBase64,
          },
        })),
      clearPartnerAudio: () => set({ partnerAudio: {} }),
      setVoiceId: (voiceId) => set({ voiceId }),
      setRedirectAfterOnboarding: (redirectAfterOnboarding) => set({ redirectAfterOnboarding }),
      setShowDashboard: (showDashboard) => set({ showDashboard }),

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

      setHasCompletedOnboarding: (hasCompletedOnboarding) => {
        // #region agent log
        // Instrument state change
        if (__DEV__) {
          import('@/utils/architectureDebugger').then(({ instrumentStateChange }) => {
            const oldValue = get().hasCompletedOnboarding;
            set({ hasCompletedOnboarding });
            
            instrumentStateChange('onboarding', {
              key: 'hasCompletedOnboarding',
              oldValue,
              newValue: hasCompletedOnboarding,
              reason: 'Direct setter called',
            });
          }).catch(() => {
            set({ hasCompletedOnboarding });
          });
        } else {
          set({ hasCompletedOnboarding });
        }
        // #endregion
      },
      completeOnboarding: () => {
        // #region agent log
        // Instrument state change
        if (__DEV__) {
          import('@/utils/architectureDebugger').then(({ instrumentStateChange }) => {
            const oldValue = get().hasCompletedOnboarding;
            set({ hasCompletedOnboarding: true, showDashboard: true }); // Set showDashboard to go to Dashboard immediately
            
            instrumentStateChange('onboarding', {
              key: 'hasCompletedOnboarding',
              oldValue,
              newValue: true,
              reason: 'User completed onboarding flow',
            });
          }).catch(() => {
            set({ hasCompletedOnboarding: true, showDashboard: true });
          });
        } else {
          set({ hasCompletedOnboarding: true, showDashboard: true }); // Set showDashboard to go to Dashboard immediately
        }
        // #endregion
      },
      reset: () => set({ ...baseState }),
    }),
    {
      name: 'onboarding-storage', // Storage key
      storage: createJSONStorage(() => AsyncStorage),
      version: 5, // Bumped for showDashboard flag
      migrate: (persistedState: any, version) => {
        if (version < 2) {
          // Migrate genderPreference from string to number
          if (persistedState && typeof persistedState === 'object') {
            persistedState.genderPreference = migrateGenderPreference(persistedState.genderPreference);
          }
        }
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
        return persistedState;
      },
      // Persist everything except functions
      partialize: (state) => ({
        relationshipIntensity: state.relationshipIntensity,
        genderPreference: state.genderPreference,
        relationshipMode: state.relationshipMode,
        birthDate: state.birthDate,
        birthTime: state.birthTime,
        birthCity: state.birthCity,
        currentCity: state.currentCity,
        primaryLanguage: state.primaryLanguage,
        secondaryLanguage: state.secondaryLanguage,
        languageImportance: state.languageImportance,
        name: state.name,
        hookReadings: state.hookReadings,
        hookAudio: state.hookAudio, // Persist pre-loaded audio
        partnerAudio: state.partnerAudio, // Persist partner pre-loaded audio
        voiceId: state.voiceId,
        // New People & Readings Library
        people: state.people, // All saved people profiles
        readings: state.readings, // All generated readings with audio/PDF paths
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        redirectAfterOnboarding: state.redirectAfterOnboarding,
        // showDashboard is NOT persisted - always starts as false on app launch
        _hasHydrated: state._hasHydrated,
      } as any),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
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
    relationshipIntensity: state.relationshipIntensity,
    relationshipMode: state.relationshipMode,
    primaryLanguage: state.primaryLanguage.code,
    secondaryLanguage: state.secondaryLanguage?.code,
    languageImportance: state.languageImportance,
    currentCity: state.currentCity,
  };
};

// DEPRECATED - causes infinite loops. Use individual selectors.
export const useProfileSnapshot = () => undefined;
