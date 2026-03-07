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
export interface HDGatePosition {
    gate: number;
    line: number;
}
export type HDCenterType = 'Head' | 'Ajna' | 'Throat' | 'G' | 'Heart' | 'Spleen' | 'Solar Plexus' | 'Sacral' | 'Root';
export type HDType = 'Generator' | 'Manifesting Generator' | 'Projector' | 'Manifestor' | 'Reflector';
export type HDAuthority = 'Emotional' | 'Sacral' | 'Splenic' | 'Ego Manifested' | 'Ego Projected' | 'Self-Projected' | 'Mental' | 'Lunar';
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
    activeGates: number[];
    activeChannels: string[];
    definedCenters: HDCenterType[];
    openCenters: HDCenterType[];
    type: HDType;
    strategy: string;
    authority: HDAuthority;
    profile: string;
    definition: string;
    incarnationCross: string;
}
export declare const HD_CHANNELS: HDChannelConfig[];
/**
 * Calculate complete Human Design profile from planetary positions
 */
export declare function calculateHumanDesign(positions: PlanetaryPositions): HDProfile;
//# sourceMappingURL=humanDesignCalculator.d.ts.map