import { env } from '@/config/env';

export type VedicNadi = 'adi' | 'madhya' | 'antya';
export type VedicVarna = 'brahmin' | 'kshatriya' | 'vaishya' | 'shudra';
export type VedicGana = 'deva' | 'manushya' | 'rakshasa';

export type VedicPersonPayload = {
  id: string;
  moon_sign: string;
  moon_nakshatra: string;
  moon_lord?: string;
  nadi?: VedicNadi;
  varna?: VedicVarna;
  yoni?: string;
  gana?: VedicGana;
  vashya?: string;
  mars_placement_house?: number;
  relationship_preference_scale?: number;
};

export type VedicScoreBreakdown = {
  varna: number;
  vashya: number;
  tara: number;
  yoni: number;
  graha_maitri: number;
  gana: number;
  bhakoot: number;
  nadi: number;
  total: number;
};

export type VedicGate = {
  eligible: boolean;
  reasons: string[];
};

export type VedicMatchResponse = {
  success: boolean;
  result?: any;
  error?: string;
};

export type VedicScoreResponse = {
  success: boolean;
  total?: number;
  breakdown?: VedicScoreBreakdown;
  eligibility?: VedicGate;
  error?: string;
};

export type VedicRankedCandidate = {
  target_id: string;
  scores: VedicScoreBreakdown;
  gate: VedicGate;
  spice: {
    user_a_spice: number;
    user_b_spice: number;
    spice_distance: number;
    spice_alignment_score: number;
  };
  vedic_rank_score: number;
  final_rank_score: number;
};

export type VedicRankResponse = {
  success: boolean;
  matches?: VedicRankedCandidate[];
  total_candidates?: number;
  matches_found?: number;
  excluded_by_gate?: number;
  error?: string;
};

type MatchOptions = {
  minimumViableScore?: number;
  allowNadiCancellation?: boolean;
  applySimpleManglikGate?: boolean;
};

type RankOptions = MatchOptions & {
  weightVedic?: number;
  weightSpice?: number;
  includeIneligible?: boolean;
};

async function safeJson(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

export async function calculateVedicMatch(params: {
  person_a: VedicPersonPayload;
  person_b: VedicPersonPayload;
  options?: MatchOptions;
}): Promise<VedicMatchResponse> {
  try {
    const response = await fetch(`${env.CORE_API_URL}/api/vedic/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const json = await safeJson(response);
    if (!response.ok) {
      return { success: false, error: json?.error || `Request failed (${response.status})` };
    }

    return { success: true, result: json?.result || json };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Network error' };
  }
}

export async function calculateVedicScore(params: {
  person_a: VedicPersonPayload;
  person_b: VedicPersonPayload;
  options?: MatchOptions;
}): Promise<VedicScoreResponse> {
  try {
    const response = await fetch(`${env.CORE_API_URL}/api/vedic/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const json = await safeJson(response);
    if (!response.ok) {
      return { success: false, error: json?.error || `Request failed (${response.status})` };
    }

    return {
      success: true,
      total: typeof json?.total === 'number' ? json.total : undefined,
      breakdown: json?.breakdown,
      eligibility: json?.eligibility,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Network error' };
  }
}

export async function rankVedicCandidates(params: {
  source: VedicPersonPayload;
  candidates: VedicPersonPayload[];
  options?: RankOptions;
}): Promise<VedicRankResponse> {
  try {
    const response = await fetch(`${env.CORE_API_URL}/api/vedic/rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const json = await safeJson(response);
    if (!response.ok) {
      return { success: false, error: json?.error || `Request failed (${response.status})` };
    }

    return {
      success: true,
      matches: Array.isArray(json?.matches) ? json.matches : [],
      total_candidates: typeof json?.total_candidates === 'number' ? json.total_candidates : undefined,
      matches_found: typeof json?.matches_found === 'number' ? json.matches_found : undefined,
      excluded_by_gate: typeof json?.excluded_by_gate === 'number' ? json.excluded_by_gate : undefined,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Network error' };
  }
}
