/**
 * Human Design Calculator
 * 
 * Calculates Human Design bodygraph from planetary positions:
 * - Type (Generator, Projector, Manifestor, Reflector)
 * - Strategy
 * - Authority
 * - Profile
 * - Defined/Open Centers
 * - Channels & Gates
 * - Incarnation Cross
 * 
 * Ported from frontend with complete type determination logic.
 */

import { tropicalLongitudeToGeneKey, type GeneKeyPosition } from './geneKeysCalculator';

export interface HDGatePosition {
  gate: number;
  line: number;
}

export type HDCenterType =
  | 'Head'
  | 'Ajna'
  | 'Throat'
  | 'G'
  | 'Heart'
  | 'Spleen'
  | 'Solar Plexus'
  | 'Sacral'
  | 'Root';

export type HDType = 'Generator' | 'Manifesting Generator' | 'Projector' | 'Manifestor' | 'Reflector';

export type HDAuthority = 
  | 'Emotional' 
  | 'Sacral' 
  | 'Splenic' 
  | 'Ego Manifested'
  | 'Ego Projected'
  | 'Self-Projected' 
  | 'Mental' 
  | 'Lunar';

export interface HDChannelConfig {
  id: string;
  name: string;
  gate1: number;
  gate2: number;
  center1: HDCenterType;
  center2: HDCenterType;
}

export interface PlanetaryPositions {
  personality: {
    sun?: number;
    earth?: number;
    moon?: number;
    northNode?: number;
    southNode?: number;
    mercury?: number;
    venus?: number;
    mars?: number;
    jupiter?: number;
    saturn?: number;
    uranus?: number;
    neptune?: number;
    pluto?: number;
  };
  design: {
    sun?: number;
    earth?: number;
    moon?: number;
    northNode?: number;
    southNode?: number;
    mercury?: number;
    venus?: number;
    mars?: number;
    jupiter?: number;
    saturn?: number;
    uranus?: number;
    neptune?: number;
    pluto?: number;
  };
}

export interface HDProfile {
  // Planetary activations
  personality: {
    sun: HDGatePosition;
    earth: HDGatePosition;
    moon: HDGatePosition;
    northNode: HDGatePosition;
    southNode: HDGatePosition;
    mercury: HDGatePosition;
    venus: HDGatePosition;
    mars: HDGatePosition;
    jupiter: HDGatePosition;
    saturn: HDGatePosition;
    uranus: HDGatePosition;
    neptune: HDGatePosition;
    pluto: HDGatePosition;
  };
  design: {
    sun: HDGatePosition;
    earth: HDGatePosition;
    moon: HDGatePosition;
    northNode: HDGatePosition;
    southNode: HDGatePosition;
    mercury: HDGatePosition;
    venus: HDGatePosition;
    mars: HDGatePosition;
    jupiter: HDGatePosition;
    saturn: HDGatePosition;
    uranus: HDGatePosition;
    neptune: HDGatePosition;
    pluto: HDGatePosition;
  };
  // Bodygraph analysis
  activeGates: number[];
  activeChannels: string[];
  definedCenters: HDCenterType[];
  openCenters: HDCenterType[];
  // Type determination
  type: HDType;
  strategy: string;
  authority: HDAuthority;
  profile: string; // e.g., "3/5"
  definition: string; // Single, Split, Triple Split, Quadruple Split
  incarnationCross: string;
}

// All 36 channels in Human Design
export const HD_CHANNELS: HDChannelConfig[] = [
  { id: '1-8', name: 'Inspiration', gate1: 1, gate2: 8, center1: 'G', center2: 'Throat' },
  { id: '2-14', name: 'The Beat', gate1: 2, gate2: 14, center1: 'G', center2: 'Sacral' },
  { id: '3-60', name: 'Mutation', gate1: 3, gate2: 60, center1: 'Sacral', center2: 'Root' },
  { id: '4-63', name: 'Logic', gate1: 4, gate2: 63, center1: 'Ajna', center2: 'Head' },
  { id: '5-15', name: 'Rhythm', gate1: 5, gate2: 15, center1: 'Sacral', center2: 'G' },
  { id: '6-59', name: 'Intimacy', gate1: 6, gate2: 59, center1: 'Solar Plexus', center2: 'Sacral' },
  { id: '7-31', name: 'The Alpha', gate1: 7, gate2: 31, center1: 'G', center2: 'Throat' },
  { id: '9-52', name: 'Concentration', gate1: 9, gate2: 52, center1: 'Sacral', center2: 'Root' },
  { id: '10-20', name: 'Awakening', gate1: 10, gate2: 20, center1: 'G', center2: 'Throat' },
  { id: '10-34', name: 'Exploration', gate1: 10, gate2: 34, center1: 'G', center2: 'Sacral' },
  { id: '10-57', name: 'Survival', gate1: 10, gate2: 57, center1: 'G', center2: 'Spleen' },
  { id: '11-56', name: 'Curiosity', gate1: 11, gate2: 56, center1: 'Ajna', center2: 'Throat' },
  { id: '12-22', name: 'Openness', gate1: 12, gate2: 22, center1: 'Throat', center2: 'Solar Plexus' },
  { id: '13-33', name: 'The Prodigal', gate1: 13, gate2: 33, center1: 'G', center2: 'Throat' },
  { id: '16-48', name: 'Talent', gate1: 16, gate2: 48, center1: 'Throat', center2: 'Spleen' },
  { id: '17-62', name: 'Acceptance', gate1: 17, gate2: 62, center1: 'Ajna', center2: 'Throat' },
  { id: '18-58', name: 'Judgment', gate1: 18, gate2: 58, center1: 'Spleen', center2: 'Root' },
  { id: '19-49', name: 'Sensitivity', gate1: 19, gate2: 49, center1: 'Root', center2: 'Solar Plexus' },
  { id: '20-34', name: 'Charisma', gate1: 20, gate2: 34, center1: 'Throat', center2: 'Sacral' },
  { id: '21-45', name: 'Money Line', gate1: 21, gate2: 45, center1: 'Heart', center2: 'Throat' },
  { id: '23-43', name: 'Structuring', gate1: 23, gate2: 43, center1: 'Throat', center2: 'Ajna' },
  { id: '24-61', name: 'Awareness', gate1: 24, gate2: 61, center1: 'Ajna', center2: 'Head' },
  { id: '25-51', name: 'Initiation', gate1: 25, gate2: 51, center1: 'G', center2: 'Heart' },
  { id: '26-44', name: 'Transmission', gate1: 26, gate2: 44, center1: 'Heart', center2: 'Spleen' },
  { id: '27-50', name: 'Preservation', gate1: 27, gate2: 50, center1: 'Sacral', center2: 'Spleen' },
  { id: '28-38', name: 'Struggle', gate1: 28, gate2: 38, center1: 'Spleen', center2: 'Root' },
  { id: '29-46', name: 'Discovery', gate1: 29, gate2: 46, center1: 'Sacral', center2: 'G' },
  { id: '30-41', name: 'Recognition', gate1: 30, gate2: 41, center1: 'Solar Plexus', center2: 'Root' },
  { id: '32-54', name: 'Transformation', gate1: 32, gate2: 54, center1: 'Spleen', center2: 'Root' },
  { id: '34-57', name: 'Power', gate1: 34, gate2: 57, center1: 'Sacral', center2: 'Spleen' },
  { id: '35-36', name: 'Transitoriness', gate1: 35, gate2: 36, center1: 'Throat', center2: 'Solar Plexus' },
  { id: '37-40', name: 'Community', gate1: 37, gate2: 40, center1: 'Solar Plexus', center2: 'Heart' },
  { id: '39-55', name: 'Emoting', gate1: 39, gate2: 55, center1: 'Root', center2: 'Solar Plexus' },
  { id: '42-53', name: 'Maturation', gate1: 42, gate2: 53, center1: 'Sacral', center2: 'Root' },
  { id: '47-64', name: 'Abstraction', gate1: 47, gate2: 64, center1: 'Ajna', center2: 'Head' },
  // Note: 57-34 is same as 34-57, removed duplicate
];

const ALL_CENTERS: HDCenterType[] = [
  'Head', 'Ajna', 'Throat', 'G', 'Heart', 'Spleen', 'Solar Plexus', 'Sacral', 'Root'
];

// Motor centers (can provide energy to Throat for Manifestor determination)
const MOTOR_CENTERS: HDCenterType[] = ['Heart', 'Sacral', 'Solar Plexus', 'Root'];

/**
 * Determine Human Design Type based on defined centers and channels
 */
function determineType(definedCenters: Set<HDCenterType>, activeChannels: string[]): HDType {
  const hasSacral = definedCenters.has('Sacral');
  const hasThroat = definedCenters.has('Throat');
  
  // Reflector: NO centers defined
  if (definedCenters.size === 0) {
    return 'Reflector';
  }
  
  // Generator or Manifesting Generator: Sacral defined
  if (hasSacral) {
    // Check if any motor is connected to Throat (makes it Manifesting Generator)
    const hasMotorToThroat = activeChannels.some(channelId => {
      const channel = HD_CHANNELS.find(c => c.id === channelId);
      if (!channel) return false;
      
      // Check if this channel connects a motor center to Throat
      const connectsMotorToThroat = 
        (MOTOR_CENTERS.includes(channel.center1) && channel.center2 === 'Throat') ||
        (MOTOR_CENTERS.includes(channel.center2) && channel.center1 === 'Throat');
      
      return connectsMotorToThroat;
    });
    
    return hasMotorToThroat ? 'Manifesting Generator' : 'Generator';
  }
  
  // Manifestor: Motor connected to Throat (but NOT Sacral defined)
  if (hasThroat && !hasSacral) {
    const hasMotorToThroat = activeChannels.some(channelId => {
      const channel = HD_CHANNELS.find(c => c.id === channelId);
      if (!channel) return false;
      
      const connectsMotorToThroat = 
        (MOTOR_CENTERS.includes(channel.center1) && channel.center2 === 'Throat') ||
        (MOTOR_CENTERS.includes(channel.center2) && channel.center1 === 'Throat');
      
      return connectsMotorToThroat;
    });
    
    if (hasMotorToThroat) {
      return 'Manifestor';
    }
  }
  
  // Projector: NO Sacral, NO motor to Throat
  return 'Projector';
}

/**
 * Determine Authority based on defined centers (hierarchy)
 */
function determineAuthority(definedCenters: Set<HDCenterType>, type: HDType): HDAuthority {
  // Reflector: Lunar Authority
  if (type === 'Reflector') {
    return 'Lunar';
  }
  
  // Emotional Authority (highest priority if Solar Plexus defined)
  if (definedCenters.has('Solar Plexus')) {
    return 'Emotional';
  }
  
  // Sacral Authority (Generators only)
  if (definedCenters.has('Sacral') && (type === 'Generator' || type === 'Manifesting Generator')) {
    return 'Sacral';
  }
  
  // Splenic Authority
  if (definedCenters.has('Spleen')) {
    return 'Splenic';
  }
  
  // Ego Authority
  if (definedCenters.has('Heart')) {
    // Ego Manifested (for Manifestors)
    if (type === 'Manifestor') {
      return 'Ego Manifested';
    }
    // Ego Projected (for Projectors)
    return 'Ego Projected';
  }
  
  // Self-Projected Authority (G center defined, connected to Throat)
  if (definedCenters.has('G') && definedCenters.has('Throat')) {
    return 'Self-Projected';
  }
  
  // Mental Authority (Ajna and/or Head defined, no other authority)
  if (definedCenters.has('Ajna') || definedCenters.has('Head')) {
    return 'Mental';
  }
  
  // Default to Mental (should rarely reach here)
  return 'Mental';
}

/**
 * Determine Strategy based on Type
 */
function determineStrategy(type: HDType): string {
  switch (type) {
    case 'Generator':
      return 'To Respond';
    case 'Manifesting Generator':
      return 'To Respond, then Inform';
    case 'Projector':
      return 'Wait for Invitation';
    case 'Manifestor':
      return 'To Inform';
    case 'Reflector':
      return 'Wait a Lunar Cycle';
  }
}

/**
 * Calculate Profile from conscious/unconscious Sun gates
 */
function calculateProfile(personalitySun: HDGatePosition, designSun: HDGatePosition): string {
  const line1 = personalitySun.line || 1;
  const line2 = designSun.line || 1;
  return `${line1}/${line2}`;
}

/**
 * Determine Definition type based on how centers are connected
 */
function determineDefinition(definedCenters: Set<HDCenterType>, activeChannels: string[]): string {
  if (definedCenters.size === 0) {
    return 'No Definition';
  }
  
  // Build a graph of connected centers
  const connections = new Map<HDCenterType, Set<HDCenterType>>();
  definedCenters.forEach(center => connections.set(center, new Set()));
  
  activeChannels.forEach(channelId => {
    const channel = HD_CHANNELS.find(c => c.id === channelId);
    if (channel && definedCenters.has(channel.center1) && definedCenters.has(channel.center2)) {
      connections.get(channel.center1)!.add(channel.center2);
      connections.get(channel.center2)!.add(channel.center1);
    }
  });
  
  // Count separate definition groups using DFS
  const visited = new Set<HDCenterType>();
  let groups = 0;
  
  function dfs(center: HDCenterType) {
    if (visited.has(center)) return;
    visited.add(center);
    connections.get(center)?.forEach(neighbor => dfs(neighbor));
  }
  
  definedCenters.forEach(center => {
    if (!visited.has(center)) {
      groups++;
      dfs(center);
    }
  });
  
  switch (groups) {
    case 0:
      return 'No Definition';
    case 1:
      return 'Single Definition';
    case 2:
      return 'Split Definition';
    case 3:
      return 'Triple Split Definition';
    default:
      return 'Quadruple Split Definition';
  }
}

/**
 * Calculate Incarnation Cross from Sun/Earth gates
 */
function calculateIncarnationCross(
  personalitySun: HDGatePosition,
  personalityEarth: HDGatePosition,
  designSun: HDGatePosition,
  designEarth: HDGatePosition
): string {
  // Format: "Right Angle Cross of [Personality Sun] / [Design Sun]"
  // or "Left Angle Cross" or "Juxtaposition Cross" depending on profile
  
  const profile = `${personalitySun.line}/${designSun.line}`;
  const psun = personalitySun.gate;
  const dsun = designSun.gate;
  
  // Determine cross type based on profile
  const line1 = personalitySun.line;
  const line2 = designSun.line;
  
  let crossType = '';
  if ([1, 2, 3, 4].includes(line1) && [1, 2, 3, 4].includes(line2)) {
    crossType = 'Right Angle Cross';
  } else if ([4, 5, 6].includes(line1) && [4, 5, 6].includes(line2)) {
    crossType = 'Left Angle Cross';
  } else {
    crossType = 'Juxtaposition Cross';
  }
  
  return `${crossType} of ${psun}/${dsun}`;
}

/**
 * Calculate complete Human Design profile from planetary positions
 */
export function calculateHumanDesign(positions: PlanetaryPositions): HDProfile {
  const getGate = (longitude?: number): HDGatePosition => {
    if (typeof longitude !== 'number') return { gate: 0, line: 0 };
    const gk = tropicalLongitudeToGeneKey(longitude);
    return { gate: gk.geneKey, line: gk.line };
  };

  const personality = {
    sun: getGate(positions.personality.sun),
    earth: getGate(positions.personality.earth),
    moon: getGate(positions.personality.moon),
    northNode: getGate(positions.personality.northNode),
    southNode: getGate(positions.personality.southNode),
    mercury: getGate(positions.personality.mercury),
    venus: getGate(positions.personality.venus),
    mars: getGate(positions.personality.mars),
    jupiter: getGate(positions.personality.jupiter),
    saturn: getGate(positions.personality.saturn),
    uranus: getGate(positions.personality.uranus),
    neptune: getGate(positions.personality.neptune),
    pluto: getGate(positions.personality.pluto),
  };

  const design = {
    sun: getGate(positions.design.sun),
    earth: getGate(positions.design.earth),
    moon: getGate(positions.design.moon),
    northNode: getGate(positions.design.northNode),
    southNode: getGate(positions.design.southNode),
    mercury: getGate(positions.design.mercury),
    venus: getGate(positions.design.venus),
    mars: getGate(positions.design.mars),
    jupiter: getGate(positions.design.jupiter),
    saturn: getGate(positions.design.saturn),
    uranus: getGate(positions.design.uranus),
    neptune: getGate(positions.design.neptune),
    pluto: getGate(positions.design.pluto),
  };

  // Collect all activated gates
  const allGates = new Set<number>();
  Object.values(personality).forEach(p => { if (p.gate > 0) allGates.add(p.gate); });
  Object.values(design).forEach(p => { if (p.gate > 0) allGates.add(p.gate); });
  const activeGates = Array.from(allGates);

  // Identify defined channels and centers
  const activeChannels: string[] = [];
  const definedCenters = new Set<HDCenterType>();

  HD_CHANNELS.forEach(channel => {
    if (allGates.has(channel.gate1) && allGates.has(channel.gate2)) {
      activeChannels.push(channel.id);
      definedCenters.add(channel.center1);
      definedCenters.add(channel.center2);
    }
  });

  const openCenters = ALL_CENTERS.filter(center => !definedCenters.has(center));

  // Determine type, authority, strategy, profile
  const type = determineType(definedCenters, activeChannels);
  const authority = determineAuthority(definedCenters, type);
  const strategy = determineStrategy(type);
  const profile = calculateProfile(personality.sun, design.sun);
  const definition = determineDefinition(definedCenters, activeChannels);
  const incarnationCross = calculateIncarnationCross(
    personality.sun,
    personality.earth,
    design.sun,
    design.earth
  );

  return {
    personality,
    design,
    activeGates,
    activeChannels,
    definedCenters: Array.from(definedCenters),
    openCenters,
    type,
    strategy,
    authority,
    profile,
    definition,
    incarnationCross,
  };
}
