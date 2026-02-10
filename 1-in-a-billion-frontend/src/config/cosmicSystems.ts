/**
 * COSMIC SYSTEMS CONFIGURATION
 * 
 * Maps all 5 cosmic systems for extended readings:
 * 1. Western Astrology - Tropical zodiac
 * 2. Vedic/Jyotish Astrology - Sidereal zodiac
 * 3. Human Design - Bodygraph system
 * 4. Kabbalah - Tree of Life / Hebrew archetypes
 * 5. Gene Keys - (coming soon) Richard Rudd's system
 */

export type CosmicSystem = 'western' | 'vedic' | 'humanDesign' | 'kabbalah' | 'geneKeys';

export type SystemConfig = {
  id: CosmicSystem;
  name: string;
  displayName: string;
  tagline: string;
  description: string;
  colorGrading: {
    primary: string;
    secondary: string;
    accent: string;
    gradient: [string, string, string];
    tint: string; // Color overlay for images
  };
  icon: string; // Emoji for quick display
  assetPath: string;
  available: boolean;
};

export const COSMIC_SYSTEMS: Record<CosmicSystem, SystemConfig> = {
  western: {
    id: 'western',
    name: 'Western Astrology',
    displayName: 'Western',
    tagline: 'Your Tropical Blueprint',
    description: 'The classical zodiac system based on the tropical year and seasonal equinoxes.',
    colorGrading: {
      primary: '#1a237e', // Deep indigo
      secondary: '#3949ab',
      accent: '#7986cb',
      gradient: ['#1a237e', '#283593', '#3949ab'],
      tint: 'rgba(26, 35, 126, 0.4)',
    },
    icon: '♈',
    assetPath: 'zodiac/rashis', // Uses the rashi images
    available: true,
  },
  
  vedic: {
    id: 'vedic',
    name: 'Vedic Jyotish',
    displayName: 'Vedic',
    tagline: 'Ancient Sidereal Wisdom',
    description: 'The 5,000-year-old Indian system aligned with fixed stars and nakshatras.',
    colorGrading: {
      primary: '#e65100', // Deep saffron/orange
      secondary: '#ff6d00',
      accent: '#ffc107',
      gradient: ['#bf360c', '#e65100', '#ff6d00'],
      tint: 'rgba(230, 81, 0, 0.4)',
    },
    icon: '🕉️',
    assetPath: 'zodiac/rashis', // Uses the same rashi images with different color grading
    available: true,
  },
  
  humanDesign: {
    id: 'humanDesign',
    name: 'Human Design',
    displayName: 'Human Design',
    tagline: 'Your Energetic Blueprint',
    description: 'A synthesis of I Ching, astrology, Kabbalah, and the chakra system.',
    colorGrading: {
      primary: '#00695c', // Deep teal
      secondary: '#00897b',
      accent: '#4db6ac',
      gradient: ['#004d40', '#00695c', '#00897b'],
      tint: 'rgba(0, 105, 92, 0.4)',
    },
    icon: '⬡', // Hexagon for bodygraph
    assetPath: 'systems/human-design.png',
    available: true,
  },
  
  kabbalah: {
    id: 'kabbalah',
    name: 'Kabbalah',
    displayName: 'Kabbalah',
    tagline: 'Tree of Life Archetypes',
    description: 'The mystical Hebrew system mapping the soul through the Tree of Life.',
    colorGrading: {
      primary: '#4a148c', // Deep purple
      secondary: '#7b1fa2',
      accent: '#ba68c8',
      gradient: ['#311b92', '#4a148c', '#7b1fa2'],
      tint: 'rgba(74, 20, 140, 0.4)',
    },
    icon: '✡️',
    assetPath: 'systems/kabbalah',
    available: true,
  },
  
  geneKeys: {
    id: 'geneKeys',
    name: 'Gene Keys',
    displayName: 'Gene Keys',
    tagline: 'Your Golden Path',
    description: 'Richard Rudd\'s system of 64 Gene Keys unlocking your highest potential.',
    colorGrading: {
      primary: '#880e4f', // Deep magenta/rose
      secondary: '#ad1457',
      accent: '#f48fb1',
      gradient: ['#880e4f', '#ad1457', '#d81b60'],
      tint: 'rgba(136, 14, 79, 0.4)',
    },
    icon: '🧬',
    assetPath: 'systems/gene-keys', // Coming soon
    available: false, // Not yet implemented
  },
};

// Get all available systems
export const getAvailableSystems = (): SystemConfig[] => {
  return Object.values(COSMIC_SYSTEMS).filter(s => s.available);
};

// Get system by ID
export const getSystem = (id: CosmicSystem): SystemConfig => {
  return COSMIC_SYSTEMS[id];
};

// Nuclear fusion - all systems combined
export const NUCLEAR_FUSION_CONFIG = {
  name: 'Cosmic Fusion',
  displayName: '∞ Nuclear',
  tagline: 'All Systems United',
  description: 'The ultimate synthesis - all 5 cosmic systems merged into one complete reading.',
  colorGrading: {
    primary: '#000000',
    secondary: '#1a1a2e',
    accent: '#d4af37', // Gold
    gradient: ['#0a0a0a', '#1a1a2e', '#2d2d44'] as [string, string, string],
    // Multi-color chromatic effect
    chromaticColors: [
      '#1a237e', // Western - indigo
      '#e65100', // Vedic - orange  
      '#00695c', // Human Design - teal
      '#4a148c', // Kabbalah - purple
      '#880e4f', // Gene Keys - magenta
    ],
  },
  icon: '💫',
};

// Order for displaying systems in extended readings
export const SYSTEM_ORDER: CosmicSystem[] = [
  'western',
  'vedic', 
  'humanDesign',
  'kabbalah',
  'geneKeys',
];

// Kabbalah Sephirot images mapping
// These are the 14 Kabbalah images with Hebrew names
export const KABBALAH_IMAGES = [
  '082EF620-0CDC-4F2D-95A4-5369D848FF63.png',
  '0843E35E-D182-4E04-8EB6-AB1A998A4109.png',
  '23D2AAB5-86D3-4A88-B4EA-C04F0F499C68.png',
  '32556A54-1CC4-42C9-A303-366945CCF097.png',
  '36689D07-8E50-4375-9668-3646CE1DA36F.png',
  '8093200C-BB59-400E-9A39-FE7713389D78.png',
  '9F9FB40C-4F98-4F60-8B56-06F69CC603D0.png',
  'A79033C7-5373-4D50-8595-217F9CD85F34.png',
  'BCE98729-D4D6-40E2-AB12-194449ED6DC5.png',
  'C1F5DA92-0A05-4D66-A487-C35BDC9C3FC5.png',
  'D78C6932-AC85-4262-B6FC-23F87E50B5A5.png',
  'D9637EA6-0332-440F-8B45-67BD3F0C2C82.png',
  'E5A918E7-CF81-454B-AF17-929856D9203C.png',
  'E624D61B-B5D4-4B6C-9585-CBE2C2B5D18C.png',
];















