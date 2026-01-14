/**
 * PROMPT SYSTEM TYPES
 * 
 * Defines the structure for all reading prompts across the app.
 */

// The five astrological systems
export type AstroSystem = 'western' | 'vedic' | 'gene_keys' | 'human_design' | 'kabbalah';

// Writing style variants
export type WritingStyle = 'production' | 'spicy_surreal';

// Reading types by scope
export type ReadingType = 'individual' | 'single_overlay' | 'nuclear';

// Target voice (who the reading is for)
export type TargetVoice = 'self' | 'other';

// Spice level (0-10)
export type SpiceLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Person data for readings
export interface PersonData {
  name: string;
  birthDate: string;      // YYYY-MM-DD
  birthTime: string;      // HH:MM
  birthLocation: string;
  timezone: string;
  latitude: number;
  longitude: number;
}

// Planetary position (from Swiss Ephemeris)
export interface PlanetaryPosition {
  sign: string;
  degree: number;
  minute: number;
  house?: number;
}

// Western chart data
export interface WesternChartData {
  sun: PlanetaryPosition;
  moon: PlanetaryPosition;
  rising: PlanetaryPosition;
  mercury?: PlanetaryPosition;
  venus?: PlanetaryPosition;
  mars?: PlanetaryPosition;
  jupiter?: PlanetaryPosition;
  saturn?: PlanetaryPosition;
  uranus?: PlanetaryPosition;
  neptune?: PlanetaryPosition;
  pluto?: PlanetaryPosition;
  aspects?: AspectData[];
  houses?: HouseData[];
}

// Vedic chart data
export interface VedicChartData {
  sun: PlanetaryPosition & { nakshatra: string; pada: number; ruler: string };
  moon: PlanetaryPosition & { nakshatra: string; pada: number; ruler: string };
  rising: PlanetaryPosition;
  ayanamsa: number;
  dashas?: DashaData[];
  yogas?: string[];
}

// Gene Keys data
export interface GeneKeysData {
  lifesWork: { key: number; name: string; shadow: string; gift: string; siddhi: string };
  evolution: { key: number; name: string; shadow: string; gift: string; siddhi: string };
  radiance: { key: number; name: string; shadow: string; gift: string; siddhi: string };
  purpose: { key: number; name: string; shadow: string; gift: string; siddhi: string };
  personalityVenus?: { key: number; name: string };
  designVenus?: { key: number; name: string };
  personalityMoon?: { key: number; name: string };
  designMoon?: { key: number; name: string };
}

// Human Design data
export interface HumanDesignData {
  type: 'Generator' | 'Manifesting Generator' | 'Projector' | 'Manifestor' | 'Reflector';
  strategy: string;
  authority: string;
  profile: string;
  definition: string;
  definedCenters: string[];
  openCenters: string[];
  channels?: string[];
  gates?: number[];
  incarnationCross?: string;
}

// Kabbalah data
export interface KabbalahData {
  primarySephirah: string;
  tikkun: string;
  fourWorlds: {
    fire: number;   // Atziluth
    water: number;  // Beriah
    air: number;    // Yetzirah
    earth: number;  // Assiyah
  };
  hebrewMonth?: string;
  pastLifeIndicators?: string[];
}

// Aspect data
export interface AspectData {
  planet1: string;
  planet2: string;
  aspect: 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile';
  orb: number;
}

// House data
export interface HouseData {
  house: number;
  sign: string;
  degree: number;
  planets: string[];
}

// Dasha data (Vedic timing)
export interface DashaData {
  planet: string;
  start: string;
  end: string;
  current: boolean;
}

// Complete chart data for one person
export interface CompleteChartData {
  person: PersonData;
  western?: WesternChartData;
  vedic?: VedicChartData;
  geneKeys?: GeneKeysData;
  humanDesign?: HumanDesignData;
  kabbalah?: KabbalahData;
}

// Synastry data (relationship aspects)
export interface SynastryData {
  aspects: AspectData[];
  houseOverlays: { planet: string; inHouse: number; ofPerson: 'A' | 'B' }[];
  compositeHighlights?: string[];
}

// Reading configuration
export interface ReadingConfig {
  readingType: ReadingType;
  system: AstroSystem | 'all';  // 'all' for nuclear
  style: WritingStyle;
  spiceLevel: SpiceLevel;
  target: TargetVoice;
  personA: CompleteChartData;
  personB?: CompleteChartData;  // For overlays and nuclear
  synastry?: SynastryData;      // For overlays and nuclear
}

// Word count targets by reading type
export const WORD_COUNTS: Record<ReadingType, { min: number; target: number; max: number }> = {
  individual: { min: 7500, target: 8000, max: 8500 },
  single_overlay: { min: 11000, target: 12000, max: 13000 },
  nuclear: { min: 28000, target: 30000, max: 32000 },
};

// Audio duration estimates (minutes)
export const AUDIO_DURATION: Record<ReadingType, number> = {
  individual: 60,      // ~1 hour
  single_overlay: 90,  // ~1.5 hours
  nuclear: 150,        // ~2.5 hours
};

// API call structure for nuclear (5 parts)
export const NUCLEAR_PARTS = [
  { name: 'Portraits in Shadow', words: 7000 },
  { name: 'The Hunger', words: 6000 },
  { name: 'The Abyss', words: 6000 },
  { name: 'The Labyrinth', words: 6000 },
  { name: 'The Mirror Breaks', words: 5000 },
] as const;

