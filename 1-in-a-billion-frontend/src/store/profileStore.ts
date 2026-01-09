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
  
  // Text content (optional - may not be loaded for artifact-only readings)
  content?: string;
  compatibilityScore?: number; // 1-10
  conclusion?: string;
  generatedAt?: string;
  source?: 'claude' | 'deepseek' | 'gpt';
  wordCount?: number;
  note?: string; // For Vedic: "This is the second reading" etc.
  readingNumber?: number; // For Vedic: 1, 2, 3, etc.
  
  // Artifact paths (for Audible-style library)
  pdfPath?: string; // Signed URL or storage path
  audioPath?: string; // Signed URL or storage path
  songPath?: string; // Signed URL or storage path
  
  // Job tracking
  jobId?: string; // Source job that generated this reading
  docNum?: number; // Document number in the job (1-16)
  
  // Metadata
  duration?: number; // Audio duration in seconds
  createdAt?: string; // Job creation timestamp
};

// NEW: Saved Audio type
export type SavedAudio = {
  id: string;
  readingId: string; // Links to the reading it was generated from
  personId?: string; // For individual readings
  person1Id?: string; // For compatibility readings
  person2Id?: string;
  system: ReadingSystem;
  fileName: string;
  filePath: string;
  durationSeconds: number;
  fileSizeMB: number;
  createdAt: string;
  title: string; // Display name like "Your Western Reading"
};

// NEW: Saved PDF type
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
  isUser: boolean; // true for the main user
  isVerified?: boolean; // KYC completed
  gender?: 'male' | 'female'; // For UI color coding
  birthData: BirthData;
  placements?: Placements;
  hookReadings?: HookReading[]; // Sun/Moon/Rising free preview readings
  hookAudioPaths?: Partial<Record<HookReading['type'], string>>; // Supabase Storage paths for hook audios (optional)
  readings: Reading[];
  jobIds?: string[]; // Job IDs associated with this person (for quick lookup)
  createdAt: string;
  updatedAt: string;
};

export type CompatibilityReading = {
  id: string;
  person1Id: string;
  person2Id: string;
  system: ReadingSystem;
  content: string;
  // Dual-truth compatibility: always store BOTH axes (0.0–10.0)
  spicyScore: number; // Chemistry / erotic charge
  safeStableScore: number; // Safety / stability / longevity
  conclusion: string;
  generatedAt: string;
  source: 'claude' | 'deepseek' | 'gpt';
};

type ProfileState = {
  // Hydration state
  hasHydrated: boolean;

  // Data
  people: Person[];
  compatibilityReadings: CompatibilityReading[];
  savedAudios: SavedAudio[];
  savedPDFs: SavedPDF[];

  // Actions - People
  addPerson: (person: Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'readings'>) => string;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  upsertPersonById: (person: Person) => void; // for cloud restore / de-dupe
  deletePerson: (id: string) => void;
  getPerson: (id: string) => Person | undefined;
  getUser: () => Person | undefined;
  repairPeople: () => { mergedCount: number };
  repairReadings: () => { removedCount: number };
  cleanupDuplicateUsers: () => { mergedCount: number }; // NEW: Merge duplicate "You" profiles
  removeIncorrectUserProfile: () => { success: boolean; message: string; removedCount: number }; // NEW: Remove incorrect user profile based on placements
  fixDuplicateIds: () => { fixedCount: number }; // NEW: Regenerate IDs for people with duplicate IDs
  setHookReadings: (personId: string, readings: HookReading[]) => void;
  getHookReadings: (personId: string) => HookReading[] | undefined;
  getAllPeopleWithHookReadings: () => Person[];

  // Actions - Readings
  addReading: (personId: string, reading: Omit<Reading, 'id'>) => string;
  deleteReading: (personId: string, readingId: string) => void;
  getReadings: (personId: string, system?: ReadingSystem) => Reading[];
  syncReadingArtifacts: (personId: string, readingId: string, artifacts: { pdfPath?: string; audioPath?: string; songPath?: string; duration?: number }) => void;
  createPlaceholderReadings: (personId: string, jobId: string, systems: ReadingSystem[], createdAt: string) => void;
  getReadingsByJobId: (personId: string, jobId: string) => Reading[];
  linkJobToPerson: (personId: string, jobId: string) => void;
  linkJobToPersonByName: (personName: string, jobId: string) => void;

  // Actions - Compatibility
  addCompatibilityReading: (reading: Omit<CompatibilityReading, 'id'>) => string;
  getCompatibilityReadings: (person1Id: string, person2Id: string) => CompatibilityReading[];
  clearCompatibilityReadings: () => void;

  // Actions - Audio
  addSavedAudio: (audio: Omit<SavedAudio, 'id'>) => string;
  upsertSavedAudioById: (audio: SavedAudio) => void; // for cloud restore / de-dupe
  deleteSavedAudio: (id: string) => void;
  getSavedAudios: () => SavedAudio[];
  getAudioForReading: (readingId: string) => SavedAudio | undefined;

  // Actions - PDF
  addSavedPDF: (pdf: Omit<SavedPDF, 'id'>) => string;
  deleteSavedPDF: (id: string) => void;
  getSavedPDFs: () => SavedPDF[];

  // Actions - KYC
  setUserVerified: (verified: boolean) => void;
  isUserVerified: () => boolean;

  // Stats
  getLibraryStats: () => {
    totalReadings: number;
    totalAudios: number;
    totalPDFs: number;
    totalPeople: number;
    totalCompatibility: number;
  };

  // Reset
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

const sanitizeBirthData = (p: any): BirthData => {
  const bd = p?.birthData || {};
  return {
    birthDate: typeof bd.birthDate === 'string' ? bd.birthDate : '',
    birthTime: typeof bd.birthTime === 'string' ? bd.birthTime : '',
    birthCity: typeof bd.birthCity === 'string' ? bd.birthCity : '',
    timezone: typeof bd.timezone === 'string' ? bd.timezone : '',
    latitude: typeof bd.latitude === 'number' && Number.isFinite(bd.latitude) ? bd.latitude : 0,
    longitude: typeof bd.longitude === 'number' && Number.isFinite(bd.longitude) ? bd.longitude : 0,
  };
};

const mergePeople = (a: any, b: any): Person => {
  // Keep the "better" record as base, then merge the other into it.
  // Strong rule: if one has a real birthDate and the other doesn't, keep the birthDate one as base (stable id).
  const aHasBD = hasMeaningfulBirthDate(a);
  const bHasBD = hasMeaningfulBirthDate(b);
  let base = a;
  let other = b;
  if (aHasBD && !bHasBD) {
    base = a;
    other = b;
  } else if (bHasBD && !aHasBD) {
    base = b;
    other = a;
  } else {
    const aScore = birthCompletenessScore(a) + (Array.isArray(a?.readings) ? a.readings.length : 0) + (a?.placements ? 1 : 0);
    const bScore = birthCompletenessScore(b) + (Array.isArray(b?.readings) ? b.readings.length : 0) + (b?.placements ? 1 : 0);
    base = aScore >= bScore ? a : b;
    other = base === a ? b : a;
  }

  const baseBirth = sanitizeBirthData(base);
  const otherBirth = sanitizeBirthData(other);
  const mergedBirth =
    birthCompletenessScore({ birthData: otherBirth }) > birthCompletenessScore({ birthData: baseBirth })
      ? otherBirth
      : baseBirth;

  const mergedReadings: Reading[] = [
    ...(Array.isArray(base?.readings) ? base.readings : []),
    ...(Array.isArray(other?.readings) ? other.readings : []),
  ];

  const createdAtCandidates = [base?.createdAt, other?.createdAt].filter((x) => typeof x === 'string') as string[];
  const createdAt = createdAtCandidates.sort()[0] || new Date().toISOString();

  const mergedHookAudioPaths = {
    ...(other?.hookAudioPaths || {}),
    ...(base?.hookAudioPaths || {}),
  };

  // CRITICAL: For user profiles, prefer the name from the record marked as user
  // For other profiles, prefer the newer name based on updatedAt timestamp
  const baseUpdatedAt = base?.updatedAt ? new Date(base.updatedAt).getTime() : 0;
  const otherUpdatedAt = other?.updatedAt ? new Date(other.updatedAt).getTime() : 0;
  const baseIsUser = Boolean(base?.isUser);
  const otherIsUser = Boolean(other?.isUser);
  
  let preferredName: string;
  if (baseIsUser && !otherIsUser) {
    preferredName = typeof base?.name === 'string' ? base.name : (typeof other?.name === 'string' ? other.name : 'Unknown');
  } else if (otherIsUser && !baseIsUser) {
    preferredName = typeof other?.name === 'string' ? other.name : (typeof base?.name === 'string' ? base.name : 'Unknown');
  } else if (otherUpdatedAt > baseUpdatedAt) {
    // Neither is user, or both are users - prefer newer name
    preferredName = typeof other?.name === 'string' ? other.name : (typeof base?.name === 'string' ? base.name : 'Unknown');
  } else {
    // Default to base name (original logic)
    preferredName = typeof base?.name === 'string' ? base.name : (typeof other?.name === 'string' ? other.name : 'Unknown');
  }

  return {
    ...other,
    ...base,
    id: base.id,
    name: preferredName,
    isUser: Boolean(base?.isUser),
    isVerified: Boolean(base?.isVerified || other?.isVerified),
    birthData: mergedBirth,
    placements: base?.placements || other?.placements,
    hookAudioPaths: Object.keys(mergedHookAudioPaths).length ? mergedHookAudioPaths : undefined,
    readings: mergedReadings,
    createdAt,
    updatedAt: new Date().toISOString(),
  } as Person;
};

const dedupePeopleState = (state: any) => {
  const people: any[] = Array.isArray(state?.people) ? state.people : [];
  if (people.length <= 1) return { nextState: state, mergedCount: 0, idMap: {} as Record<string, string> };

  const idMap: Record<string, string> = {};
  const survivors: any[] = [];
  let mergedCount = 0;

  // Group by (nameKey + isUser), then within group only merge if birthDate matches OR either is unknown.
  const groups = new Map<string, any[]>();
  for (const p of people) {
    const key = `${norm(p?.name)}|${p?.isUser ? 'user' : 'partner'}`;
    const arr = groups.get(key) || [];
    arr.push(p);
    groups.set(key, arr);
  }

  for (const [, group] of groups) {
    // Partition further by birthDate when both are known; unknown birthDate will be merged into the best-known record.
    const knownByBirth = new Map<string, any[]>();
    const unknown: any[] = [];

    for (const p of group) {
      const bd = birthDateValue(p);
      if (!bd) unknown.push(p);
      else {
        const arr = knownByBirth.get(bd) || [];
        arr.push(p);
        knownByBirth.set(bd, arr);
      }
    }

    // First, merge duplicates within each known birthDate bucket.
    const knownSurvivors: any[] = [];
    for (const [, bucket] of knownByBirth) {
      if (bucket.length === 1) {
        knownSurvivors.push(bucket[0]);
        continue;
      }
      let merged = bucket[0];
      for (let i = 1; i < bucket.length; i++) {
        const next = bucket[i];
        const beforeId = next?.id;
        merged = mergePeople(merged, next);
        if (beforeId) idMap[beforeId] = merged.id;
        mergedCount += 1;
      }
      // Ensure id maps for all merged bucket items
      for (const p of bucket) {
        if (p?.id && p.id !== merged.id) idMap[p.id] = merged.id;
      }
      knownSurvivors.push(merged);
    }

    // If we have at least one known survivor, merge all unknown into the best-known.
    if (knownSurvivors.length > 0) {
      // Pick best-known to absorb unknowns
      let absorber = knownSurvivors.sort((x, y) => (birthCompletenessScore(y) + (y?.readings?.length || 0)) - (birthCompletenessScore(x) + (x?.readings?.length || 0)))[0];
      for (const u of unknown) {
        const beforeId = u?.id;
        absorber = mergePeople(absorber, u);
        if (beforeId) idMap[beforeId] = absorber.id;
        mergedCount += 1;
      }
      survivors.push(absorber);
      // Add remaining known survivors that are not the absorber (different birthDate, same name)
      for (const p of knownSurvivors) {
        if (p?.id !== absorber.id) survivors.push(p);
      }
    } else {
      // Only unknowns: keep the "best" and merge the rest.
      if (unknown.length === 0) continue;
      let absorber = unknown.sort((x, y) => (birthCompletenessScore(y) + (y?.readings?.length || 0)) - (birthCompletenessScore(x) + (x?.readings?.length || 0)))[0];
      for (const u of unknown) {
        if (u?.id === absorber.id) continue;
        const beforeId = u?.id;
        absorber = mergePeople(absorber, u);
        if (beforeId) idMap[beforeId] = absorber.id;
        mergedCount += 1;
      }
      for (const u of unknown) {
        if (u?.id && u.id !== absorber.id) idMap[u.id] = absorber.id;
      }
      survivors.push(absorber);
    }
  }

  // Ensure birthData is always present (prevents crashes and makes UI consistent)
  const normalizedPeople = survivors.map((p) => ({
    ...p,
    birthData: sanitizeBirthData(p),
  }));

  const remapId = (id?: string) => (id && idMap[id] ? idMap[id] : id);

  const nextState = {
    ...state,
    people: normalizedPeople,
    compatibilityReadings: Array.isArray(state?.compatibilityReadings)
      ? state.compatibilityReadings.map((r: any) => ({
        ...r,
        person1Id: remapId(r?.person1Id),
        person2Id: remapId(r?.person2Id),
      }))
      : state?.compatibilityReadings,
    savedAudios: Array.isArray(state?.savedAudios)
      ? state.savedAudios.map((a: any) => ({
        ...a,
        personId: remapId(a?.personId),
        person1Id: remapId(a?.person1Id),
        person2Id: remapId(a?.person2Id),
      }))
      : state?.savedAudios,
    savedPDFs: Array.isArray(state?.savedPDFs)
      ? state.savedPDFs.map((p: any) => ({
        ...p,
        personId: remapId(p?.personId),
        person1Id: remapId(p?.person1Id),
        person2Id: remapId(p?.person2Id),
      }))
      : state?.savedPDFs,
  };

  return { nextState, mergedCount, idMap };
};

const initialState = {
  hasHydrated: false,
  people: [] as Person[],
  compatibilityReadings: [] as CompatibilityReading[],
  savedAudios: [] as SavedAudio[],
  savedPDFs: [] as SavedPDF[],
};

const dedupeReadingsForPerson = (readings: any[]) => {
  // Remove duplicates that have same signature (system + wordCount + content prefix) within a small time window
  // AND remove exact duplicates regardless of time (same signature).
  const bySig = new Map<string, any[]>();
  for (const r of Array.isArray(readings) ? readings : []) {
    const sig = `${r?.system}|${r?.wordCount}|${String(r?.content || '').slice(0, 180)}`;
    const arr = bySig.get(sig) || [];
    arr.push(r);
    bySig.set(sig, arr);
  }

  const kept: any[] = [];
  let removed = 0;

  for (const [, group] of bySig) {
    // Sort newest first so we keep the most recent representation of identical content
    const sorted = [...group].sort((a, b) => (Date.parse(b?.generatedAt) || 0) - (Date.parse(a?.generatedAt) || 0));
    const survivor = sorted[0];
    if (survivor) kept.push(survivor);
    if (sorted.length > 1) removed += sorted.length - 1;
  }

  // Preserve chronological order (newest first) for UI
  kept.sort((a, b) => (Date.parse(b?.generatedAt) || 0) - (Date.parse(a?.generatedAt) || 0));
  return { next: kept as Reading[], removed };
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // People Actions
      addPerson: (personData) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:addPerson:entry',message:'addPerson called',data:{personName:personData?.name,isUser:personData?.isUser,existingPeopleCount:get().people.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        
        // CRITICAL FIX: If this is a "self" profile (isUser: true), always upsert into existing user
        // This prevents duplicate "You" entries on every login/recalculation
        if (personData?.isUser === true) {
          const existingUser = get().people.find((p) => p.isUser);
          if (existingUser) {
            console.log(`👤 Updating existing user profile "${existingUser.name}" -> "${personData.name}"`);
            // Merge with best-of-both
            set((state) => {
              const merged = mergePeople(existingUser, personData);
              return {
                people: state.people.map((p) => (p.id === existingUser.id ? merged : p)),
              };
            });
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:addPerson:existingUser',message:'Updated existing user',data:{personId:existingUser.id,personName:personData?.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
            // #endregion
            return existingUser.id;
          }
          // No existing user, create first one
          console.log(`👤 Creating first user profile "${personData.name}"`);
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
          set((state) => ({
            people: [...state.people, person],
          }));
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:addPerson:newUser',message:'Created new user',data:{personId:id,personName:personData?.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          return id;
        }

        // For non-user (partner) profiles, use existing deduplication logic
        const targetName = norm(personData?.name);
        const targetBirthDate = birthDateValue(personData);

        // DEDUPLICATION:
        // - If birthDate is known: match by (name + birthDate) OR (name + unknown birthDate)
        // - If birthDate is unknown: match by name only (merge into best existing)
        const candidates = get().people.filter((p) => {
          if (norm(p?.name) !== targetName) return false;
          const pBd = birthDateValue(p);
          if (targetBirthDate && pBd) return pBd === targetBirthDate;
          // if either side is unknown, consider it a merge candidate
          return true;
        });
        const existingPerson = candidates.length > 0 ? candidates[0] : undefined;

        if (existingPerson) {
          console.log(`👤 Person "${personData.name}" already exists, returning existing ID`);
          // Merge with best-of-both (especially when previous entry had unknown birth data)
          set((state) => {
            const merged = mergePeople(existingPerson, personData);
            return {
              people: state.people.map((p) => (p.id === existingPerson.id ? merged : p)),
            };
          });
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:addPerson:deduplicated',message:'Person already exists, returned existing ID',data:{personId:existingPerson.id,personName:personData?.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          return existingPerson.id;
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
        set((state) => ({
          people: [...state.people, person],
        }));
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:addPerson:newPerson',message:'Created new person',data:{personId:id,personName:personData?.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        return id;
      },

      updatePerson: (id, updates) => {
        set((state) => ({
          people: state.people.map((p) =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      upsertPersonById: (incoming) => {
        if (!incoming?.id) return;
        set((state) => {
          const idx = state.people.findIndex((p) => p.id === incoming.id);
          if (idx < 0) {
            // Ensure required fields exist
            const now = new Date().toISOString();
            const safePerson: Person = {
              id: incoming.id,
              name: incoming.name || 'Unknown',
              isUser: Boolean(incoming.isUser),
              birthData: sanitizeBirthData(incoming),
              placements: incoming.placements,
              hookReadings: incoming.hookReadings,
              hookAudioPaths: incoming.hookAudioPaths,
              readings: Array.isArray(incoming.readings) ? incoming.readings : [],
              createdAt: incoming.createdAt || now,
              updatedAt: incoming.updatedAt || now,
              isVerified: incoming.isVerified,
            };
            return { people: [...state.people, safePerson] };
          }

          const existing = state.people[idx];
          
          // CRITICAL: For user profiles, prefer local name over Supabase name (local is authoritative)
          // For other profiles, prefer the newer name based on updatedAt timestamp
          const existingUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const incomingUpdatedAt = incoming.updatedAt ? new Date(incoming.updatedAt).getTime() : 0;
          const preferLocalName = existing.isUser || (existingUpdatedAt > incomingUpdatedAt);
          const preferredName = preferLocalName && existing.name ? existing.name : (incoming.name || existing.name);
          
          const merged: Person = {
            ...existing,
            ...incoming,
            name: preferredName, // Use preferred name instead of blindly taking incoming
            // Preserve deep readings already cached locally unless incoming explicitly has them
            readings: Array.isArray(incoming.readings) && incoming.readings.length > 0 ? incoming.readings : existing.readings,
            // Ensure birthData is always sanitized
            birthData: sanitizeBirthData(incoming?.birthData ? incoming : { ...existing, ...incoming }),
            updatedAt: incoming.updatedAt || existing.updatedAt || new Date().toISOString(),
          };

          const next = [...state.people];
          next[idx] = merged;
          return { people: next };
        });
      },

      deletePerson: (id) => {
        set((state) => ({
          people: state.people.filter((p) => p.id !== id),
          compatibilityReadings: state.compatibilityReadings.filter(
            (r) => r.person1Id !== id && r.person2Id !== id
          ),
        }));
      },

      getPerson: (id) => {
        const found = get().people.find((p) => p.id === id);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:getPerson',message:'Person lookup',data:{searchId:id,found:!!found,foundName:found?.name,totalPeople:get().people.length,allPeople:get().people.map(p=>({id:p.id,name:p.name}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        return found;
      },

      getUser: () => {
        return get().people.find((p) => p.isUser);
      },

      repairPeople: () => {
        const { nextState, mergedCount } = dedupePeopleState(get());
        set(nextState);
        return { mergedCount };
      },

      repairReadings: () => {
        let removedCount = 0;
        set((state) => {
          const nextPeople = state.people.map((p) => {
            const { next, removed } = dedupeReadingsForPerson(p.readings || []);
            removedCount += removed;
            return { ...p, readings: next };
          });
          return { ...state, people: nextPeople };
        });
        return { removedCount };
      },

      cleanupDuplicateUsers: () => {
        const users = get().people.filter((p) => p.isUser);
        if (users.length <= 1) {
          console.log('✅ No duplicate user profiles found');
          return { mergedCount: 0 };
        }

        console.log(`🔧 Found ${users.length} duplicate user profiles, merging...`);

        // Merge all users into the "best" one (most complete data)
        let merged = users.sort((a, b) =>
          (birthCompletenessScore(b) + (b.readings?.length || 0)) -
          (birthCompletenessScore(a) + (a.readings?.length || 0))
        )[0];

        for (let i = 1; i < users.length; i++) {
          merged = mergePeople(merged, users[i]);
        }

        // Create ID map for remapping references
        const idMap: Record<string, string> = {};
        for (const user of users) {
          if (user.id !== merged.id) {
            idMap[user.id] = merged.id;
          }
        }

        const remapId = (id?: string) => (id && idMap[id] ? idMap[id] : id);

        // Update state: keep only the merged user, remap all references
        set((state) => ({
          people: [merged, ...state.people.filter((p) => !p.isUser)],
          compatibilityReadings: state.compatibilityReadings.map((r) => ({
            ...r,
            person1Id: remapId(r.person1Id) || r.person1Id,
            person2Id: remapId(r.person2Id) || r.person2Id,
          })),
          savedAudios: state.savedAudios.map((a) => ({
            ...a,
            personId: remapId(a.personId),
            person1Id: remapId(a.person1Id),
            person2Id: remapId(a.person2Id),
          })),
          savedPDFs: state.savedPDFs.map((p) => ({
            ...p,
            personId: remapId(p.personId),
            person1Id: remapId(p.person1Id),
            person2Id: remapId(p.person2Id),
          })),
        }));

        console.log(`✅ Merged ${users.length - 1} duplicate user profiles into one`);
        return { mergedCount: users.length - 1 };
      },

      removeIncorrectUserProfile: () => {
        const users = get().people.filter((p) => p.isUser);

        if (users.length <= 1) {
          console.log('✅ Only one or no user profiles found, no cleanup needed');
          return { success: true, message: 'No duplicates found', removedCount: 0 };
        }

        console.log(`🔍 Found ${users.length} user profiles, identifying correct one...`);

        // Find the correct profile: Virgo Sun | Leo Moon | Sagittarius Rising
        const correctProfile = users.find((user) => {
          const placements = user.placements;
          if (!placements) return false;

          const sunSign = placements.sunSign?.toLowerCase().trim();
          const moonSign = placements.moonSign?.toLowerCase().trim();
          const risingSign = placements.risingSign?.toLowerCase().trim();

          return sunSign === 'virgo' &&
            moonSign === 'leo' &&
            risingSign === 'sagittarius';
        });

        if (!correctProfile) {
          console.log('❌ Could not find the correct Virgo Sun | Leo Moon | Sagittarius Rising profile');
          console.log('Available user profiles:');
          users.forEach((u, i) => {
            console.log(`  ${i + 1}. ${u.placements?.sunSign || 'Unknown'} Sun | ${u.placements?.moonSign || 'Unknown'} Moon | ${u.placements?.risingSign || 'Unknown'} Rising`);
          });
          return { success: false, message: 'Correct profile not found', removedCount: 0 };
        }

        console.log(`✅ Found correct profile: ${correctProfile.name} (ID: ${correctProfile.id})`);
        console.log(`   ☀️  Sun: ${correctProfile.placements?.sunSign}`);
        console.log(`   🌙 Moon: ${correctProfile.placements?.moonSign}`);
        console.log(`   ⬆️  Rising: ${correctProfile.placements?.risingSign}`);

        // Identify incorrect profiles
        const incorrectProfiles = users.filter((u) => u.id !== correctProfile.id);

        if (incorrectProfiles.length === 0) {
          console.log('✅ No incorrect profiles to remove');
          return { success: true, message: 'Only correct profile exists', removedCount: 0 };
        }

        console.log(`\n🗑️  Removing ${incorrectProfiles.length} incorrect profile(s):`);
        incorrectProfiles.forEach((u) => {
          console.log(`   - ${u.name} (ID: ${u.id})`);
          console.log(`     ${u.placements?.sunSign || 'Unknown'} Sun | ${u.placements?.moonSign || 'Unknown'} Moon | ${u.placements?.risingSign || 'Unknown'} Rising`);
        });

        // Filter out incorrect user profiles, keep all non-user profiles
        set((state) => ({
          people: state.people.filter((p) => {
            if (!p.isUser) return true; // Keep all non-user profiles
            return p.id === correctProfile.id; // Keep only the correct user profile
          }),
        }));

        console.log(`\n✅ Cleanup complete!`);
        console.log(`   Kept: ${correctProfile.name} (Virgo Sun | Leo Moon | Sagittarius Rising)`);
        console.log(`   Removed: ${incorrectProfiles.length} duplicate profile(s)`);

        return {
          success: true,
          message: `Removed ${incorrectProfiles.length} incorrect profile(s)`,
          removedCount: incorrectProfiles.length
        };
      },

      fixDuplicateIds: () => {
        const people = get().people;
        const idCounts = new Map<string, number>();
        
        // Count occurrences of each ID
        people.forEach((p) => {
          idCounts.set(p.id, (idCounts.get(p.id) || 0) + 1);
        });
        
        // Find duplicate IDs
        const duplicateIds = Array.from(idCounts.entries())
          .filter(([_, count]) => count > 1)
          .map(([id]) => id);
        
        if (duplicateIds.length === 0) {
          console.log('✅ No duplicate IDs found');
          return { fixedCount: 0 };
        }
        
        console.log(`🔧 Found ${duplicateIds.length} duplicate ID(s), regenerating...`);
        let fixedCount = 0;
        
        set((state) => {
          const newPeople = [...state.people];
          const seenIds = new Set<string>();
          
          for (let i = 0; i < newPeople.length; i++) {
            const person = newPeople[i];
            
            if (seenIds.has(person.id)) {
              // This is a duplicate - regenerate its ID
              const oldId = person.id;
              const newId = generateId();
              console.log(`   Regenerating ID for "${person.name}": ${oldId} → ${newId}`);
              
              newPeople[i] = {
                ...person,
                id: newId,
                updatedAt: new Date().toISOString(),
              };
              fixedCount++;
            } else {
              seenIds.add(person.id);
            }
          }
          
          return { ...state, people: newPeople };
        });
        
        console.log(`✅ Fixed ${fixedCount} duplicate ID(s)`);
        return { fixedCount };
      },

      setHookReadings: (personId, readings) => {
        set((state) => ({
          people: state.people.map((p) =>
            p.id === personId
              ? { ...p, hookReadings: readings, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      getHookReadings: (personId) => {
        const person = get().people.find((p) => p.id === personId);
        return person?.hookReadings;
      },

      getAllPeopleWithHookReadings: () => {
        return get().people.filter((p) => p.hookReadings && p.hookReadings.length > 0);
      },

      // Reading Actions
      addReading: (personId, readingData) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:addReading:entry',message:'addReading called',data:{personId,readingSystem:readingData.system,hasContent:!!readingData.content,contentLength:readingData.content?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        
        const person = get().people.find((p) => p.id === personId);
        
        if (!person) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:addReading:personNotFound',message:'Person not found for reading',data:{personId,availablePeople:get().people.map(p=>({id:p.id,name:p.name}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
          // #endregion
        }
        
        // CRITICAL: Keep ALL readings - never delete on second generation
        // All systems: Always allow multiple readings, mark with version number and date
        if (person) {
          const existingReadingsForSystem = person.readings.filter((r) => r.system === readingData.system);
          const readingNumber = existingReadingsForSystem.length + 1;
          const date = new Date(readingData.generatedAt || new Date().toISOString()).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          
          const id = generateId();
          const reading: Reading = { 
            ...readingData, 
            id,
            // Add version number and date for all readings (not just Vedic)
            readingNumber,
            note: readingNumber === 1 
              ? `Generated on ${date}`
              : `This is reading ${readingNumber} for this system. Generated on ${date}.`
          };
          
          set((state) => ({
            people: state.people.map((p) =>
              p.id === personId
                ? {
                    ...p,
                    readings: [...p.readings, reading],
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:addReading:success',message:'Reading added successfully',data:{personId,personName:person.name,readingId:id,readingNumber,totalReadingsForPerson:person.readings.length+1},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
          // #endregion
          return id;
        }

        // Fallback if person not found (shouldn't happen)
        const id = generateId();
        const reading: Reading = { 
          ...readingData, 
          id,
          readingNumber: 1,
          note: `Generated on ${new Date(readingData.generatedAt || new Date().toISOString()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        };
        set((state) => ({
          people: state.people.map((p) =>
            p.id === personId
              ? {
                  ...p,
                  readings: [...p.readings, reading],
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
        return id;
      },

      deleteReading: (personId, readingId) => {
        set((state) => ({
          people: state.people.map((p) =>
            p.id === personId
              ? {
                ...p,
                readings: p.readings.filter((r) => r.id !== readingId),
                updatedAt: new Date().toISOString(),
              }
              : p
          ),
        }));
      },

      getReadings: (personId, system) => {
        const person = get().people.find((p) => p.id === personId);
        if (!person) return [];
        if (system) {
          return person.readings.filter((r) => r.system === system);
        }
        return person.readings;
      },

      syncReadingArtifacts: (personId, readingId, artifacts) => {
        // CRITICAL: Only sync if at least one artifact exists (prevents empty readings in cache)
        const hasAnyArtifact = !!(artifacts.pdfPath || artifacts.audioPath || artifacts.songPath);
        if (!hasAnyArtifact) {
          console.log(`⚠️ Skipping syncReadingArtifacts for ${readingId} - no artifacts provided`);
          return;
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:syncReadingArtifacts',message:'Syncing artifacts',data:{personId,readingId,hasPdf:!!artifacts.pdfPath,hasAudio:!!artifacts.audioPath,hasSong:!!artifacts.songPath},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STORE'})}).catch(()=>{});
        // #endregion
        set((state) => ({
          people: state.people.map((p) =>
            p.id === personId
              ? {
                  ...p,
                  readings: p.readings.map((r) =>
                    r.id === readingId
                      ? { ...r, ...artifacts }
                      : r
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      createPlaceholderReadings: (personId, jobId, systems, createdAt) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:createPlaceholderReadings:entry',message:'Creating placeholders',data:{personId,jobId,systemsCount:systems.length,systems},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STORE'})}).catch(()=>{});
        // #endregion
        const person = get().people.find((p) => p.id === personId);
        if (!person) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:createPlaceholderReadings:noPerson',message:'Person not found',data:{personId,allPeopleIds:get().people.map(p=>p.id)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STORE'})}).catch(()=>{});
          // #endregion
          return;
        }

        // Check if readings for this job already exist
        const existingJobReadings = person.readings.filter((r) => r.jobId === jobId);
        if (existingJobReadings.length > 0) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:createPlaceholderReadings:alreadyExists',message:'Placeholders already exist',data:{personId,jobId,existingCount:existingJobReadings.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STORE'})}).catch(()=>{});
          // #endregion
          console.log(`⚠️ Placeholder readings for job ${jobId} already exist, skipping creation`);
          return;
        }

        // Create placeholder readings for each system
        const placeholderReadings: Reading[] = systems.map((system, index) => ({
          id: generateId(),
          system,
          content: '', // Empty until text is generated
          generatedAt: createdAt,
          source: 'claude',
          wordCount: 0,
          jobId,
          docNum: index + 1,
          createdAt,
          note: 'Processing...',
          // No artifact paths yet - they'll be synced when ready
        }));

        set((state) => ({
          people: state.people.map((p) =>
            p.id === personId
              ? {
                  ...p,
                  readings: [...p.readings, ...placeholderReadings],
                  jobIds: Array.from(new Set([...(p.jobIds || []), jobId])),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));

        console.log(`✅ Created ${placeholderReadings.length} placeholder readings for job ${jobId}`);
      },

      getReadingsByJobId: (personId, jobId) => {
        const person = get().people.find((p) => p.id === personId);
        if (!person) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:getReadingsByJobId:noPerson',message:'Person not found',data:{personId,jobId,allPeopleIds:get().people.map(p=>p.id)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STORE'})}).catch(()=>{});
          // #endregion
          return [];
        }
        const readings = person.readings.filter((r) => r.jobId === jobId);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:getReadingsByJobId:result',message:'Readings found',data:{personId,jobId,readingsCount:readings.length,personTotalReadings:person.readings.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STORE'})}).catch(()=>{});
        // #endregion
        return readings;
      },

      linkJobToPerson: (personId, jobId) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:linkJobToPerson:entry',message:'Linking job to person',data:{personId,jobId,allPeopleIds:get().people.map(p=>p.id),allPeopleNames:get().people.map(p=>p.name)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STORE'})}).catch(()=>{});
        // #endregion
        const person = get().people.find((p) => p.id === personId);
        if (!person) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:linkJobToPerson:noPerson',message:'Person not found for linking',data:{personId,jobId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STORE'})}).catch(()=>{});
          // #endregion
          return;
        }
        const oldJobIds = person.jobIds || [];
        set((state) => ({
          people: state.people.map((p) =>
            p.id === personId
              ? {
                  ...p,
                  jobIds: Array.from(new Set([...(p.jobIds || []), jobId])),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
        // #region agent log
        const updatedPerson = get().people.find((p) => p.id === personId);
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profileStore.ts:linkJobToPerson:result',message:'Job linked successfully',data:{personId,jobId,oldJobIdsCount:oldJobIds.length,newJobIdsCount:updatedPerson?.jobIds?.length||0,newJobIds:updatedPerson?.jobIds},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STORE'})}).catch(()=>{});
        // #endregion
      },

      linkJobToPersonByName: (personName, jobId) => {
        const person = get().people.find((p) => p.name === personName);
        if (!person) return;
        linkJobToPerson(person.id, jobId);
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

      clearCompatibilityReadings: () => {
        set({ compatibilityReadings: [] });
      },

      // Audio Actions
      addSavedAudio: (audioData) => {
        const id = generateId();
        const audio: SavedAudio = { ...audioData, id };
        set((state) => ({
          savedAudios: [...state.savedAudios, audio],
        }));
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

      deleteSavedAudio: (id) => {
        set((state) => ({
          savedAudios: state.savedAudios.filter((a) => a.id !== id),
        }));
      },

      getSavedAudios: () => {
        return get().savedAudios;
      },

      getAudioForReading: (readingId) => {
        return get().savedAudios.find((a) => a.readingId === readingId);
      },

      // PDF Actions
      addSavedPDF: (pdfData) => {
        const id = generateId();
        const pdf: SavedPDF = { ...pdfData, id };
        set((state) => ({
          savedPDFs: [...state.savedPDFs, pdf],
        }));
        return id;
      },

      deleteSavedPDF: (id) => {
        set((state) => ({
          savedPDFs: state.savedPDFs.filter((p) => p.id !== id),
        }));
      },

      getSavedPDFs: () => {
        return get().savedPDFs;
      },

      // KYC Actions
      setUserVerified: (verified) => {
        set((state) => ({
          people: state.people.map((p) =>
            p.isUser ? { ...p, isVerified: verified, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      isUserVerified: () => {
        const user = get().people.find((p) => p.isUser);
        return user?.isVerified ?? false;
      },

      // Library Stats
      getLibraryStats: () => {
        const state = get();
        const user = state.people.find((p) => p.isUser);
        const totalReadings = state.people.reduce((acc, p) => acc + p.readings.length, 0);
        return {
          totalReadings,
          totalAudios: state.savedAudios.length,
          totalPDFs: state.savedPDFs.length,
          totalPeople: state.people.filter((p) => !p.isUser).length,
          totalCompatibility: state.compatibilityReadings.length,
        };
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'profile-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 6,
      onRehydrateStorage: () => {
        console.log('📦 Profile store: Starting hydration from AsyncStorage...');
        return (state, error) => {
          if (error) {
            console.error('📦 Profile store: Hydration failed:', error);
          } else {
            console.log('📦 Profile store: Hydration complete');
            // Mark store as hydrated
            if (state) {
              state.hasHydrated = true;
            }
          }
        };
      },
      migrate: (persisted: any, version) => {
        // v2: CompatibilityReading moved from overallScore/scores -> spicyScore/safeStableScore
        if (!persisted || typeof persisted !== 'object') return persisted;

        if (version < 2) {
          try {
            const compat = Array.isArray(persisted.compatibilityReadings)
              ? persisted.compatibilityReadings
              : [];

            persisted.compatibilityReadings = compat.map((r: any) => {
              const overall = typeof r?.overallScore === 'number' ? r.overallScore : undefined;
              const longTerm = typeof r?.scores?.longTerm === 'number' ? r.scores.longTerm : undefined;
              // NO HARDCODED FALLBACKS - only use actual data or undefined
              const spicyScore = typeof r?.spicyScore === 'number' ? r.spicyScore : (overall ?? undefined);
              const safeStableScore =
                typeof r?.safeStableScore === 'number'
                  ? r.safeStableScore
                  : (longTerm ?? overall ?? undefined);

              const { overallScore, scores, ...rest } = r || {};
              return { ...rest, spicyScore, safeStableScore };
            });
          } catch {
            // If something goes wrong, keep persisted state as-is.
          }
        }

        // v3: Deduplicate people (merge unknown birth entries into known ones) and remap references.
        if (version < 3) {
          try {
            const { nextState } = dedupePeopleState(persisted);
            persisted = nextState;
          } catch {
            // keep as-is on failure
          }
        }

        // v4: Deduplicate existing readings so the UI isn't a spammy log.
        if (version < 4) {
          try {
            const people = Array.isArray(persisted?.people) ? persisted.people : [];
            persisted.people = people.map((p: any) => {
              const { next } = dedupeReadingsForPerson(p?.readings || []);
              return { ...p, readings: next };
            });
          } catch {
            // keep as-is on failure
          }
        }

        // v5: Remove hook readings (Sun/Moon/Rising) that were incorrectly auto-saved.
        // Hook readings are short (<500 words), system='western', and should NOT be in profileStore.
        // They should only be displayed via onboardingStore hookReadings.
        if (version < 5) {
          try {
            const people = Array.isArray(persisted?.people) ? persisted.people : [];
            let totalRemoved = 0;
            persisted.people = people.map((p: any) => {
              const readings = Array.isArray(p?.readings) ? p.readings : [];
              const beforeCount = readings.length;
              // Keep only readings that are either:
              // 1. NOT western, OR
              // 2. Western but > 500 words (deep readings, not hooks)
              const filtered = readings.filter((r: any) => {
                if (r?.system !== 'western') return true; // Keep all non-western
                const wordCount = typeof r?.wordCount === 'number' ? r.wordCount : 0;
                return wordCount > 500; // Keep only deep western readings
              });
              const removed = beforeCount - filtered.length;
              if (removed > 0) {
                totalRemoved += removed;
                console.log(`🧹 Migration v5: Removed ${removed} hook readings from ${p?.name || 'Unknown'}`);
              }
              return { ...p, readings: filtered };
            });
            console.log(`✅ Migration v5 complete: Removed ${totalRemoved} total hook readings`);
          } catch (e) {
            console.error('❌ Migration v5 failed:', e);
            // keep as-is on failure
          }
        }

        // v6: Remove duplicate is_user=true entries (keep newest)
        if (version < 6) {
          try {
            const people = Array.isArray(persisted?.people) ? persisted.people : [];
            const userProfiles = people.filter((p: any) => p?.isUser === true);
            
            if (userProfiles.length > 1) {
              console.log(`🧹 Migration v6: Found ${userProfiles.length} duplicate user profiles`);
              
              // Sort by created_at DESC (newest first)
              userProfiles.sort((a: any, b: any) => {
                const timeA = new Date(a.createdAt || 0).getTime();
                const timeB = new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
              });
              
              const [keep, ...toDelete] = userProfiles;
              const deleteIds = new Set(toDelete.map((p: any) => p.id));
              
              console.log(`  ✅ Keeping: "${keep.name}" (id: ${keep.id})`);
              toDelete.forEach((p: any) => {
                console.log(`  ❌ Removing: "${p.name}" (id: ${p.id})`);
              });
              
              // Filter out duplicate user profiles
              persisted.people = people.filter((p: any) => !deleteIds.has(p.id));
              
              console.log(`✅ Migration v6 complete: Removed ${toDelete.length} duplicate user profile(s)`);
            } else {
              console.log(`✅ Migration v6: No duplicate user profiles found`);
            }
          } catch (e) {
            console.error('❌ Migration v6 failed:', e);
            // keep as-is on failure
          }
        }

        return persisted;
      },
    }
  )
);

// Selectors
export const selectAllPeople = (state: ProfileState) => state.people;
export const selectUser = (state: ProfileState) => state.people.find((p) => p.isUser);
export const selectPartners = (state: ProfileState) => state.people.filter((p) => !p.isUser);
export const selectSavedAudios = (state: ProfileState) => state.savedAudios;
export const selectSavedPDFs = (state: ProfileState) => state.savedPDFs;
export const selectCompatibilityReadings = (state: ProfileState) => state.compatibilityReadings;




