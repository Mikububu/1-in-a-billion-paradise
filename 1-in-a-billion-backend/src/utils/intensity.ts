type IntensityDescriptor = {
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

export const describeIntensity = (value: number): IntensityDescriptor => {
  const entry = descriptors.find((range) => value >= range.min && value <= range.max);
  return entry ?? descriptors[0]!;
};

export const summarizeIntensity = (value: number): string => {
  if (value <= 3) {
    return 'safety-first pacing';
  }
  if (value <= 6) {
    return 'balanced polarity';
  }
  return 'heat-driven chemistry';
};

export const toneFromIntensity = (value: number): string => {
  if (value <= 3) return 'safety-first pacing';
  if (value <= 6) return 'balanced polarity';
  return 'intense ignition';
};
