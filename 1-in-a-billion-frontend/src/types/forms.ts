export type RelationshipMode = 'family' | 'sensual';

export type CityOption = {
  id: string;
  name: string;
  country: string;
  region?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type LanguageOption = {
  code: string;
  label: string;
};

export type HookReading = {
  type: 'sun' | 'moon' | 'rising';
  sign: string;
  intro: string;
  main: string;
  degree?: string;
};

