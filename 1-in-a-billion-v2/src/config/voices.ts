export type VoiceId =
    | 'david' | 'elisabeth' | 'michael' | 'peter' | 'victor'
    | 'turbo-aaron' | 'turbo-abigail' | 'turbo-andy' | 'turbo-brian'
    | 'turbo-emmanuel' | 'turbo-evelyn' | 'turbo-gavin' | 'turbo-gordon'
    | 'turbo-ivan' | 'turbo-laura' | 'turbo-lucy' | 'turbo-walter';

export type VoiceOption = {
    id: VoiceId;
    label: string;
    description: string;
    sampleUrl?: string;
    isTurbo?: boolean;
};

const SUPABASE_VOICE_SAMPLES = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples';

export const VOICE_OPTIONS: VoiceOption[] = [
    // ── Custom cloned voices ──────────────────────────────────────────────
    {
        id: 'david',
        label: 'David',
        description: 'Warm and engaging narrator',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/david/preview.mp3`,
    },
    {
        id: 'elisabeth',
        label: 'Elisabeth',
        description: 'Elegant and gentle guide',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/elisabeth/preview.mp3`,
    },
    {
        id: 'michael',
        label: 'Michael',
        description: 'Confident and grounded tone',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/michael/preview.mp3`,
    },
    {
        id: 'peter',
        label: 'Peter',
        description: 'Friendly and clear delivery',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/peter/preview.mp3`,
    },
    {
        id: 'victor',
        label: 'Victor',
        description: 'Deep cinematic presence',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/victor/preview.mp3`,
    },
    // ── Chatterbox Turbo preset voices ────────────────────────────────────
    {
        id: 'turbo-aaron',
        label: 'Aaron',
        description: 'Steady, reliable narrator',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-aaron/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-abigail',
        label: 'Abigail',
        description: 'Professional, confident voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-abigail/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-andy',
        label: 'Andy',
        description: 'Casual, approachable voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-andy/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-brian',
        label: 'Brian',
        description: 'Analytical, clear voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-brian/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-emmanuel',
        label: 'Emmanuel',
        description: 'Resonant, commanding voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-emmanuel/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-evelyn',
        label: 'Evelyn',
        description: 'Elegant, sophisticated voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-evelyn/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-gavin',
        label: 'Gavin',
        description: 'Smooth, conversational voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-gavin/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-gordon',
        label: 'Gordon',
        description: 'Authoritative, mature voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-gordon/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-ivan',
        label: 'Ivan',
        description: 'Deep, dramatic voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-ivan/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-laura',
        label: 'Laura',
        description: 'Professional, clear voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-laura/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-lucy',
        label: 'Lucy',
        description: 'Bright, cheerful voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-lucy/preview.mp3`,
        isTurbo: true,
    },
    {
        id: 'turbo-walter',
        label: 'Walter',
        description: 'Distinguished, wise voice',
        sampleUrl: `${SUPABASE_VOICE_SAMPLES}/turbo-walter/preview.mp3`,
        isTurbo: true,
    },
];
