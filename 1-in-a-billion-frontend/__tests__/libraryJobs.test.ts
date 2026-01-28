import { buildPeopleCardsFromJobs, buildPersonReadingsRowsFromJobs } from '@/screens/home/libraryJobs';

describe('buildPeopleCardsFromJobs (jobs-only library)', () => {
  test('returns empty when no jobs', () => {
    const cards = buildPeopleCardsFromJobs({
      queueJobs: [],
      storePeople: [],
      libraryPeopleById: {},
      userName: 'Michael',
      userPerson: undefined,
      selfPersonId: null,
    });
    expect(cards).toEqual([]);
  });

  test('dedupes by stable person1.id and aggregates jobIds (newest first)', () => {
    const cards = buildPeopleCardsFromJobs({
      queueJobs: [
        {
          id: 'job-old',
          type: 'extended',
          status: 'complete',
          created_at: '2025-01-01T00:00:00.000Z',
          params: { person1: { id: 'p1', name: 'Michael' } },
        },
        {
          id: 'job-new',
          type: 'extended',
          status: 'processing',
          created_at: '2026-01-01T00:00:00.000Z',
          params: { person1: { id: 'p1', name: 'Michael' } },
        },
      ],
      storePeople: [],
      libraryPeopleById: {},
      userName: 'Michael',
      userPerson: undefined,
      selfPersonId: null,
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.id).toBe('p1');
    // newest job should end up as jobIds[0] (because we process newest jobs first)
    expect(cards[0]?.jobIds?.[0]).toBe('job-new');
    expect(new Set(cards[0]?.jobIds)).toEqual(new Set(['job-old', 'job-new']));
  });

  test('falls back to name keying when id missing (still jobs-only)', () => {
    const cards = buildPeopleCardsFromJobs({
      queueJobs: [
        {
          id: 'job-1',
          type: 'extended',
          status: 'complete',
          created_at: '2026-01-01T00:00:00.000Z',
          params: { person1: { name: 'Akasha' } },
        },
      ],
      storePeople: [],
      libraryPeopleById: {},
      userName: 'Michael',
      userPerson: undefined,
      selfPersonId: null,
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.name).toBe('Akasha');
    expect(cards[0]?.jobIds).toEqual(['job-1']);
  });
});

describe('buildPersonReadingsRowsFromJobs (rows per job instance)', () => {
  test('creates multiple rows for same system across multiple jobs and sorts newest-first', () => {
    const rows = buildPersonReadingsRowsFromJobs({
      jobs: [
        {
          id: 'job-old',
          type: 'extended',
          created_at: '2025-01-01T00:00:00.000Z',
          params: { systems: ['vedic'] },
          results: { documents: [{ docNum: 1, system: 'vedic', pdfUrl: 'x', audioUrl: 'y', songUrl: 'z' }] },
        },
        {
          id: 'job-new',
          type: 'extended',
          created_at: '2026-01-01T00:00:00.000Z',
          params: { systems: ['vedic'] },
          results: { documents: [{ docNum: 1, system: 'vedic', pdfUrl: 'x', audioUrl: 'y', songUrl: 'z' }] },
        },
      ],
      personType: 'individual',
      savedPDFs: [],
      savedAudios: [],
    });

    const vedicRows = rows.filter((r) => r.system === 'vedic');
    expect(vedicRows).toHaveLength(2);
    expect(vedicRows[0]?.jobId).toBe('job-new');
    expect(vedicRows[1]?.jobId).toBe('job-old');
  });
});

