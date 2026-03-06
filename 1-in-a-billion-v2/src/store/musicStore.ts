import { create } from 'zustand';

interface MusicState {
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    isMusicLoaded: boolean;
    setIsMusicLoaded: (loaded: boolean) => void;
}

export const useMusicStore = create<MusicState>((set) => ({
    isPlaying: false, // Default to false; set to true when music actually starts playing
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    isMusicLoaded: false,
    setIsMusicLoaded: (loaded) => set({ isMusicLoaded: loaded }),
}));
