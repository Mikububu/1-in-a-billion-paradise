export type PreferenceDescriptor = {
    min: number;
    max: number;
    caption: string;
    tone: 'safe' | 'balanced' | 'adventurous';
};

const descriptors: PreferenceDescriptor[] = [
    { min: 0, max: 2, caption: 'You prefer safe, stable bonds', tone: 'safe' },
    { min: 3, max: 4, caption: 'You prefer calm with some spark', tone: 'safe' },
    { min: 5, max: 5, caption: 'You prefer balanced polarity', tone: 'balanced' },
    { min: 6, max: 7, caption: 'You prefer spicy, playful chemistry', tone: 'adventurous' },
    { min: 8, max: 10, caption: 'You prefer high-voltage connection', tone: 'adventurous' },
];

// Kept name for import stability in existing screens.
export const describeIntensity = (value: number) => {
    const entry = descriptors.find((range) => value >= range.min && value <= range.max) ?? descriptors[0];
    return entry;
};

export const summarizeIntensity = (value: number) => {
    if (value <= 3) {
        return 'seeks safety-first bonding';
    }
    if (value <= 6) {
        return 'seeks balanced polarity';
    }
    return 'seeks heat-driven chemistry';
};
