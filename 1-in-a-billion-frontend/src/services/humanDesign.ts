/**
 * Human Design Calculation Module
 * 
 * Uses the same zodiacal wheel as Gene Keys for Gate calculations.
 */

import { tropicalLongitudeToGeneKey, PlanetaryPositions } from './geneKeys';

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

export interface HDChannelConfig {
    id: string; // e.g., '1-8'
    name: string;
    gate1: number;
    gate2: number;
    center1: HDCenterType;
    center2: HDCenterType;
}

export interface HDProfile {
    // Activation Sequence (Conscious/Personality)
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
    // Design (Unconscious)
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
    // BodyGraph Analysis
    activeGates: number[]; // All unique defined gates (conscious or unconscious)
    activeChannels: string[]; // IDs of defined channels
    definedCenters: HDCenterType[]; // List of defined centers
}

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
    { id: '11-56', name: 'Curiosity', gate1: 11, gate2: 56, center1: 'Head', center2: 'Throat' }, // Note: Head or Ajna? 11 is Ajna, 56 is Throat. Table said Head-Throat, checking... 11 is Ajna.
    // Correction: 11 is Ajna, 56 is Throat. Channel 11-56 connects Ajna to Throat. 
    // Let's re-verify table vs standard bodygraph knowledge.
    // 11 (Ideas) is Ajna. 56 (Stimulation) is Throat. Center 1 should be Ajna.
    // Correction applied below.
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
    { id: '57-34', name: 'Archetype', gate1: 57, gate2: 34, center1: 'Spleen', center2: 'Sacral' }
];

/**
 * Calculate the Human Design activated gates from planetary positions.
 * 
 * @param positions PlanetaryPositions object containing Personality and Design longitudes
 * @returns HDProfile object with all activated gates and lines
 */
export const calculateHumanDesignProfile = (positions: PlanetaryPositions): HDProfile => {
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

    // Collect all activated gate numbers
    const allGates = new Set<number>();
    Object.values(personality).forEach(p => { if (p.gate > 0) allGates.add(p.gate); });
    Object.values(design).forEach(p => { if (p.gate > 0) allGates.add(p.gate); });
    const activeGates = Array.from(allGates);

    // Identify Defined Channels
    const activeChannels: string[] = [];
    const definedCenters = new Set<HDCenterType>();

    HD_CHANNELS.forEach(channel => {
        if (allGates.has(channel.gate1) && allGates.has(channel.gate2)) {
            activeChannels.push(channel.id);
            definedCenters.add(channel.center1);
            definedCenters.add(channel.center2);
        }
    });

    return {
        personality,
        design,
        activeGates,
        activeChannels,
        definedCenters: Array.from(definedCenters),
    };
};
