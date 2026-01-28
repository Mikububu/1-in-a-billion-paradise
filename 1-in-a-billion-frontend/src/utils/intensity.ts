export type IntensityDescriptor = {
  min: number;
  max: number;
  caption: string;
  tone: 'calm' | 'balanced' | 'fiery';
};

const descriptors: IntensityDescriptor[] = [
  { min: 0, max: 2, caption: 'Calm, stable, slow build', tone: 'calm' },
  { min: 3, max: 4, caption: 'Safe with spark', tone: 'calm' },
  { min: 5, max: 5, caption: 'Balanced', tone: 'balanced' },
  { min: 6, max: 7, caption: 'Spicy, playful, intense', tone: 'balanced' },
  { min: 8, max: 10, caption: 'Very fiery, boundary pushing', tone: 'fiery' },
];

export const describeIntensity = (value: number) => {
  const entry = descriptors.find((range) => value >= range.min && value <= range.max) ?? descriptors[0];
  return entry;
};

export const summarizeIntensity = (value: number) => {
  if (value <= 3) {
    return 'safety-first pacing';
  }
  if (value <= 6) {
    return 'balanced polarity';
  }
  return 'heat-driven chemistry';
};
