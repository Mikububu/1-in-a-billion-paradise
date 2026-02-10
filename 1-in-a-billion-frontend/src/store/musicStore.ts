import { create } from 'zustand';

interface MusicState {
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    isMusicLoaded: boolean;
    setIsMusicLoaded: (loaded: boolean) => void;
}

export const useMusicStore = create<MusicState>((set) => ({
    isPlaying: true, // Default to true as intro starts playing
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    isMusicLoaded: false,
    setIsMusicLoaded: (loaded) => set({ isMusicLoaded: loaded }),
}));
