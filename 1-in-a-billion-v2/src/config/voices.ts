export type VoiceId = 'david' | 'elisabeth' | 'michael' | 'peter' | 'victor';

export type VoiceOption = {
    id: VoiceId;
    label: string;
    description: string;
    sampleUrl?: string;
};

export const VOICE_OPTIONS: VoiceOption[] = [
    {
        id: 'david',
        label: 'David',
        description: 'Warm and engaging narrator',
        sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/david/preview.mp3',
    },
    {
        id: 'elisabeth',
        label: 'Elisabeth',
        description: 'Elegant and gentle guide',
        sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/elisabeth/preview.mp3',
    },
    {
        id: 'michael',
        label: 'Michael',
        description: 'Confident and grounded tone',
        sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/michael/preview.mp3',
    },
    {
        id: 'peter',
        label: 'Peter',
        description: 'Friendly and clear delivery',
        sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/peter/preview.mp3',
    },
    {
        id: 'victor',
        label: 'Victor',
        description: 'Deep cinematic presence',
        sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/victor/preview.mp3',
    },
];
