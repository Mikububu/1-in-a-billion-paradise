export type VoiceId = 'david' | 'elisabeth' | 'michael' | 'peter' | 'victor';

export type VoiceOption = {
    id: VoiceId;
    label: string;
    description: string;
};

export const VOICE_OPTIONS: VoiceOption[] = [
    {
        id: 'david',
        label: 'David',
        description: 'Warm and engaging narrator',
    },
    {
        id: 'elisabeth',
        label: 'Elisabeth',
        description: 'Elegant and gentle guide',
    },
    {
        id: 'michael',
        label: 'Michael',
        description: 'Confident and grounded tone',
    },
    {
        id: 'peter',
        label: 'Peter',
        description: 'Friendly and clear delivery',
    },
    {
        id: 'victor',
        label: 'Victor',
        description: 'Deep cinematic presence',
    },
];
