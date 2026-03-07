/**
 * VEDIC MATCHMAKING TYPE DEFINITIONS
 *
 * These types are derived from the canonical JSON schema (vedic_matchmaking.schema.json)
 * and enforce the structure defined in VEDIC_MATCHMAKING_LOGIC.md.
 *
 * FAILURE TO COMPLY WITH THESE TYPES VIOLATES THE SYSTEM CONTRACT.
 */
export type Gana = 'deva' | 'manushya' | 'rakshasa';
export type Nadi = 'adi' | 'madhya' | 'antya';
export type Varna = 'brahmin' | 'kshatriya' | 'vaishya' | 'shudra';
export type Yoni = string;
export type YoniRelationship = 'friendly' | 'neutral' | 'enemy';
export type Vashya = string;
export type TaraType = 'janma' | 'sampat' | 'vipat' | 'kshema' | 'pratyari' | 'sadhaka' | 'vadha' | 'mitra' | 'parama_mitra';
export type DoshaSeverity = 'none' | 'low' | 'medium' | 'high';
export type BhakootDoshaType = 'none' | 'shadashtaka' | 'dwirdwadasha';
export type TimingAlignment = 'favorable' | 'neutral' | 'challenging';
export type CompatibilityGrade = 'poor' | 'average' | 'good' | 'excellent' | 'exceptional';
export type ViabilityStatus = 'not_recommended' | 'conditional' | 'recommended' | 'highly_recommended';
export type Nakshatra = 'Ashwini' | 'Bharani' | 'Krittika' | 'Rohini' | 'Mrigashira' | 'Ardra' | 'Punarvasu' | 'Pushya' | 'Ashlesha' | 'Magha' | 'Purva Phalguni' | 'Uttara Phalguni' | 'Hasta' | 'Chitra' | 'Swati' | 'Vishakha' | 'Anuradha' | 'Jyeshtha' | 'Mula' | 'Purva Ashadha' | 'Uttara Ashadha' | 'Shravana' | 'Dhanishta' | 'Shatabhisha' | 'Purva Bhadrapada' | 'Uttara Bhadrapada' | 'Revati';
export interface BirthData {
    date: string;
    time: string;
    location: {
        latitude: number;
        longitude: number;
        timezone: string;
    };
}
export interface PersonChart {
    id: string;
    birth_data: BirthData;
    moon_nakshatra: Nakshatra;
    moon_sign: string;
    moon_rashi_lord: string;
    gana: Gana;
    yoni: Yoni;
    nadi: Nadi;
    varna: Varna;
    vashya: Vashya;
    pada: 1 | 2 | 3 | 4;
    mars_placement_house: number;
}
export interface VedicPerson {
    id: string;
    moon_sign: string;
    moon_nakshatra: Nakshatra;
    moon_lord: string;
    nadi: Nadi;
    varna?: Varna;
    yoni?: Yoni;
    gana?: Gana;
    vashya?: Vashya;
}
export interface KootaScoreBreakdown {
    varna: number;
    vashya: number;
    tara: number;
    yoni: number;
    graha_maitri: number;
    gana: number;
    bhakoot: number;
    nadi: number;
    total: number;
}
export interface KootaResult {
    score: number;
    max_score: number;
    description?: string;
}
export interface VarnaResult extends KootaResult {
    max_score: 1;
}
export interface VashyaResult extends KootaResult {
    max_score: 2;
}
export interface TaraResult extends KootaResult {
    max_score: 3;
    tara_type: TaraType;
}
export interface YoniResult extends KootaResult {
    max_score: 4;
    relationship: YoniRelationship;
}
export interface GrahaMaitriResult extends KootaResult {
    max_score: 5;
}
export interface GanaResult extends KootaResult {
    max_score: 6;
}
export interface BhakootResult extends KootaResult {
    max_score: 7;
    dosha_type: BhakootDoshaType;
}
export interface NadiResult extends KootaResult {
    max_score: 8;
    dosha_present: boolean;
}
export interface AshtakootaResult {
    varna: VarnaResult;
    vashya: VashyaResult;
    tara: TaraResult;
    yoni: YoniResult;
    graha_maitri: GrahaMaitriResult;
    gana: GanaResult;
    bhakoot: BhakootResult;
    nadi: NadiResult;
    total_points: number;
}
export interface ManglikAnalysis {
    person_a_present: boolean;
    person_b_present: boolean;
    cancellation_applied: boolean;
    status: 'cancelled' | 'present' | 'none';
}
export interface NadiDoshaAnalysis {
    present: boolean;
    severity: DoshaSeverity;
    exception_applied: boolean;
}
export interface BhakootDoshaAnalysis {
    present: boolean;
    type: BhakootDoshaType;
    cancelled: boolean;
}
export interface DoshaSummary {
    manglik: ManglikAnalysis;
    nadi: NadiDoshaAnalysis;
    bhakoot: BhakootDoshaAnalysis;
}
export interface SeventhHouseAnalysis {
    person_a_strength: number;
    person_b_strength: number;
    mutual_aspect_quality: 'benefic' | 'malefic' | 'neutral';
    relationship_stability_score: number;
}
export interface DashaContext {
    person_a_current_dasha: string;
    person_b_current_dasha: string;
    overlap_quality: TimingAlignment;
}
export interface FinalMatchScore {
    numeric_score: number;
    grade: CompatibilityGrade;
    viability: ViabilityStatus;
}
export interface VedicMatchmakingResult {
    schema_version: string;
    person_a: PersonChart;
    person_b: PersonChart;
    ashtakoota: AshtakootaResult;
    doshas: DoshaSummary;
    seventh_house: SeventhHouseAnalysis;
    dasha_context: DashaContext;
    final_score: FinalMatchScore;
}
//# sourceMappingURL=vedic_matchmaking.types.d.ts.map