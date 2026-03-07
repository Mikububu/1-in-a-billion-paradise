"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toneFromIntensity = exports.summarizeIntensity = exports.describeIntensity = void 0;
const descriptors = [
    { min: 0, max: 2, caption: 'Calm, stable, slow build', tone: 'calm' },
    { min: 3, max: 4, caption: 'Safe with spark', tone: 'calm' },
    { min: 5, max: 5, caption: 'Balanced', tone: 'balanced' },
    { min: 6, max: 7, caption: 'Spicy, playful, intense', tone: 'balanced' },
    { min: 8, max: 10, caption: 'Very fiery, boundary pushing', tone: 'fiery' },
];
const describeIntensity = (value) => {
    const entry = descriptors.find((range) => value >= range.min && value <= range.max);
    return entry ?? descriptors[0];
};
exports.describeIntensity = describeIntensity;
const summarizeIntensity = (value) => {
    if (value <= 3) {
        return 'safety-first pacing';
    }
    if (value <= 6) {
        return 'balanced polarity';
    }
    return 'heat-driven chemistry';
};
exports.summarizeIntensity = summarizeIntensity;
const toneFromIntensity = (value) => {
    if (value <= 3)
        return 'safety-first pacing';
    if (value <= 6)
        return 'balanced polarity';
    return 'intense ignition';
};
exports.toneFromIntensity = toneFromIntensity;
//# sourceMappingURL=intensity.js.map