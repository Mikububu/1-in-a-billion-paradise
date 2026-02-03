import type { Person } from '@/store/profileStore';

export type QueueJobLike = {
  id: string;
  type?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  params?: any;
  input?: any;
  results?: any;
};

export type LibraryPersonCard = {
  id: string;
  name: string;
  isUser: boolean;
  birthData: any;
  placements: any;
  readings: any[];
  createdAt: string;
  jobIds: string[];
};

const JOB_STATUS_ALLOWED = new Set(['complete', 'completed', 'processing', 'pending', 'queued']);
const JOB_TYPES_PERSON = new Set(['nuclear_v2', 'extended', 'single_system']);

function parseMaybeJson(value: any): any {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

/**
 * Pure builder for S12 "jobs-only" people cards.
 *
 * Rule: A person card exists iff at least one job was initiated for them.
 * Identity: prefer stable IDs (params.person1.id / params.person2.id), fallback to name.
 * Ordering: newest jobs first so jobIds[0] is the most recent receipt.
 */
export function buildPeopleCardsFromJobs(args: {
  queueJobs: QueueJobLike[];
  storePeople: Person[];
  libraryPeopleById: Record<string, Person>;
  userName: string;
  userPerson: Person | undefined;
  selfPersonId: string | null;
}): LibraryPersonCard[] {
  const { queueJobs, storePeople, libraryPeopleById, userName, userPerson, selfPersonId } = args;

  const peopleMap = new Map<string, LibraryPersonCard>();

  const queueJobsNewestFirst = [...(queueJobs || [])].sort((a, b) => {
    const ta = new Date(a?.created_at || a?.createdAt || 0).getTime();
    const tb = new Date(b?.created_at || b?.createdAt || 0).getTime();
    return tb - ta;
  });

  for (const job of queueJobsNewestFirst) {
    if (!job?.id) continue;
    if (!JOB_TYPES_PERSON.has(String(job.type || ''))) continue;
    if (!JOB_STATUS_ALLOWED.has(String(job.status || ''))) continue;

    const params = parseMaybeJson(job.params || job.input || {});
    const isProcessing = ['processing', 'pending', 'queued'].includes(String(job.status || ''));
    const p1Name = params?.person1?.name || (isProcessing ? `Reading ${String(job.id).slice(0, 8)}` : undefined);
    const p2Name = params?.person2?.name || (isProcessing && params?.person2 ? 'Partner' : undefined);
    const p1Id = params?.person1?.id;
    const p2Id = params?.person2?.id;

    const upsertPerson = (person: { id?: string; name?: string } | null | undefined, fallbackName?: string) => {
      const pid = person?.id;
      const name = person?.name || fallbackName;
      if (!name) return;

      const libMatch = pid ? libraryPeopleById[pid] : undefined;
      const storeMatch =
        libMatch ||
        (pid ? storePeople.find((sp) => sp?.id === pid) : undefined) ||
        storePeople.find((sp) => sp?.name === name) ||
        (name === userName ? userPerson : undefined);

      const storePlacements = (storeMatch as any)?.placements || {};
      const storeBirthData = (storeMatch as any)?.birthData || {};
      const key = (storeMatch?.id || pid || name) as string;
      const existing = peopleMap.get(key);

      if (existing) {
        existing.jobIds = [...new Set([...(existing.jobIds || []), job.id])];
        if (pid && existing.id !== pid && (!existing.id || existing.id === name)) {
          existing.id = pid;
        }
        if (!existing.placements?.sunSign && (storePlacements as any)?.sunSign) existing.placements = storePlacements as any;
        if (!existing.birthData?.birthDate && (storeBirthData as any)?.birthDate) existing.birthData = storeBirthData as any;
        return;
      }

      const systems = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
      const placeholderReadings = systems.map((system, index) => ({
        id: `reading-${index + 1}`,
        system,
        name:
          system === 'western'
            ? 'Western Astrology'
            : system === 'vedic'
              ? 'Vedic (Jyotish)'
              : system === 'human_design'
                ? 'Human Design'
                : system === 'gene_keys'
                  ? 'Gene Keys'
                  : 'Kabbalah',
        pdfPath: undefined,
        audioPath: undefined,
        songPath: undefined,
      }));

      const createdAt = (job.created_at || job.createdAt || new Date().toISOString()) as string;
      const stableId = storeMatch?.id || pid || `job-${job.id}`;
      const isUser =
        !!(storeMatch as any)?.isUser || (!!selfPersonId && (pid === selfPersonId || storeMatch?.id === selfPersonId));

      peopleMap.set(key, {
        id: stableId,
        name,
        isUser,
        birthData: Object.keys(storeBirthData || {}).length > 0 ? storeBirthData : (person || {}),
        placements: Object.keys(storePlacements || {}).length > 0 ? storePlacements : {},
        readings: placeholderReadings,
        createdAt,
        jobIds: [job.id],
      });
    };

    upsertPerson(params?.person1, p1Name);
    if (p2Name) upsertPerson(params?.person2, p2Name);
  }

  let result = Array.from(peopleMap.values()).sort((a, b) => {
    if (a.isUser && !b.isUser) return -1;
    if (!a.isUser && b.isUser) return 1;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  // Hard guarantee: no job receipt => no card.
  result = result.filter((p) => Array.isArray(p.jobIds) && p.jobIds.length > 0);
  return result;
}

export type PersonReadingsRow = {
  id: string;
  jobId?: string;
  docNum?: number;
  system: string;
  name: string;
  timestamp?: string;
  pdfPath?: string;
  audioPath?: string;
  songPath?: string;
  localPdfPath?: string;
  localAudioPath?: string;
  localSongPath?: string;
};

/**
 * Pure builder for S19 rows: one row per (system × job instance), newest-first by job.created_at.
 * This is intentionally conservative and does not do network I/O.
 */
export function buildPersonReadingsRowsFromJobs(args: {
  jobs: Array<{ id: string; type?: string; created_at?: string; params?: any; results?: any }>;
  personType: 'individual' | 'person1' | 'person2' | 'overlay';
  savedPDFs: Array<{ readingId?: string; filePath: string }>;
  savedAudios: Array<{ readingId?: string; filePath: string }>;
}): PersonReadingsRow[] {
  const { jobs, personType, savedPDFs, savedAudios } = args;

  const SYSTEMS = [
    { id: 'western', name: 'Western Astrology' },
    { id: 'vedic', name: 'Vedic (Jyotish)' },
    { id: 'human_design', name: 'Human Design' },
    { id: 'gene_keys', name: 'Gene Keys' },
    { id: 'kabbalah', name: 'Kabbalah' },
    { id: 'verdict', name: 'Final Verdict' },
  ];

  const getDocRange = (jobType?: string, systemCount?: number) => {
    if (personType === 'individual' || jobType === 'extended') {
      const count = systemCount || 5;
      return Array.from({ length: count }, (_, i) => i + 1);
    }
    switch (personType) {
      case 'person1':
        return [1, 2, 3, 4, 5];
      case 'person2':
        return [6, 7, 8, 9, 10];
      case 'overlay':
        return [11, 12, 13, 14, 15, 16];
      default:
        return [1, 2, 3, 4, 5];
    }
  };

  const systemIdForDoc = (jobType: string, systems: string[], docNum: number) => {
    if (jobType === 'extended' || jobType === 'single_system' || personType === 'individual') {
      const idx = Math.max(0, docNum - 1);
      return systems[idx] || SYSTEMS[idx]?.id || 'western';
    }
    if (personType === 'person1') return SYSTEMS[Math.max(0, docNum - 1)]?.id || 'western';
    if (personType === 'person2') return SYSTEMS[Math.max(0, docNum - 6)]?.id || 'western';
    if (personType === 'overlay') {
      if (docNum === 16) return 'verdict';
      return SYSTEMS[Math.max(0, docNum - 11)]?.id || 'western';
    }
    return 'western';
  };

  const sortedJobs = [...(jobs || [])].sort(
    (a, b) => (Date.parse(b?.created_at || '') || 0) - (Date.parse(a?.created_at || '') || 0)
  );

  const rows: PersonReadingsRow[] = [];

  for (const j of sortedJobs) {
    const jt = String(j?.type || '');
    if (jt === 'synastry' && personType !== 'overlay') continue;
    const createdAt = j?.created_at || new Date().toISOString();
    const systems: string[] = Array.isArray(j?.params?.systems) ? j.params.systems : [];
    const docs: any[] = Array.isArray(j?.results?.documents) ? j.results.documents : [];
    const systemCount = systems.length || 5;
    const docRange = getDocRange(jt, systemCount);

    for (const docNum of docRange) {
      const doc = docs.find((d: any) => Number(d?.docNum) === docNum) || null;
      const systemId = String(doc?.system || systemIdForDoc(jt, systems, docNum));
      const systemName = SYSTEMS.find((s) => s.id === systemId)?.name || systemId;
      const rowId = `row-${j.id}-${docNum}`;

      rows.push({
        id: rowId,
        jobId: j.id,
        docNum,
        system: systemId,
        name: systemName,
        timestamp: createdAt,
        pdfPath: doc?.pdfUrl || undefined,
        audioPath: doc?.audioUrl ? `audio://${j.id}/${docNum}` : undefined,
        songPath: doc?.songUrl ? `song://${j.id}/${docNum}` : undefined,
        localPdfPath: savedPDFs.find((p) => p.readingId === `${rowId}:pdf`)?.filePath,
        localAudioPath: savedAudios.find((a) => a.readingId === `${rowId}:audio`)?.filePath,
        localSongPath: savedAudios.find((a) => a.readingId === `${rowId}:song`)?.filePath,
      });
    }
  }

  // Within the same created_at, keep stable by name.
  rows.sort(
    (a, b) => (Date.parse(b.timestamp || '') || 0) - (Date.parse(a.timestamp || '') || 0) || a.name.localeCompare(b.name)
  );
  return rows;
}

