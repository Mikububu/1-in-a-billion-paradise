import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Audio } from 'expo-av';
import { getHookAudioSignedUrl } from '@/services/hookAudioCloud';

type ToggleAudioParams = {
    key: string;
    source?: string;
    base64?: string; // Backwards compat alias
    onFinish?: () => void;
};

type ToggleAudioResult = 'playing' | 'stopped';

type AudioContextValue = {
    toggleAudio: (params: ToggleAudioParams) => Promise<ToggleAudioResult>;
    primeAudio: (key: string, source: string) => Promise<void>;
    toggleBase64Audio: (params: ToggleAudioParams) => Promise<ToggleAudioResult>;
    stopAudio: () => Promise<void>;
    primeBase64Audio: (key: string, base64: string) => Promise<void>;
    releaseAllAudio: () => Promise<void>;
};

type CachedSound = {
    signature: string;
    sound: Audio.Sound;
};

const defaultAudioContext: AudioContextValue = {
    toggleAudio: async () => 'stopped',
    primeAudio: async () => { },
    toggleBase64Audio: async () => 'stopped',
    stopAudio: async () => { },
    primeBase64Audio: async () => { },
    releaseAllAudio: async () => { },
};

const AudioContext = createContext<AudioContextValue>(defaultAudioContext);

const isWebUrl = (v: string) => /^https?:\/\//i.test(v);
const isDataUri = (v: string) => /^data:/i.test(v);
const isFileLikeUri = (v: string) => /^(file|content|asset):\/\//i.test(v);
const isAbsoluteFilePath = (v: string) => /^\/.+\.(mp3|m4a|wav|aac)$/i.test(v);
const extractLibraryPathFromPublicUrl = (url: string): string | null => {
    try {
        const parsed = new URL(url);
        const marker = '/storage/v1/object/public/library/';
        const idx = parsed.pathname.indexOf(marker);
        if (idx < 0) return null;
        const rawPath = parsed.pathname.slice(idx + marker.length);
        return decodeURIComponent(rawPath);
    } catch {
        return null;
    }
};
const isStoragePath = (v: string) =>
    !isWebUrl(v) &&
    !isDataUri(v) &&
    !isFileLikeUri(v) &&
    !isAbsoluteFilePath(v) &&
    v.includes('/') &&
    /\.(mp3|m4a|wav|aac)(\?|$)/i.test(v);

const getSignature = (source: string) => {
    const trimmed = source.trim();
    if (isWebUrl(trimmed) || isDataUri(trimmed) || isFileLikeUri(trimmed) || isStoragePath(trimmed) || isAbsoluteFilePath(trimmed)) {
        return trimmed;
    }
    const head = trimmed.slice(0, 24);
    const tail = trimmed.slice(-24);
    return `${trimmed.length}:${head}:${tail}`;
};

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
    const cacheRef = useRef<Map<string, CachedSound>>(new Map());
    const activeKeyRef = useRef<string | null>(null);
    const activeSoundRef = useRef<Audio.Sound | null>(null);
    const audioModeReadyRef = useRef(false);

    const ensureAudioMode = useCallback(async () => {
        if (audioModeReadyRef.current) return;
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
        });
        audioModeReadyRef.current = true;
    }, []);

    const stopAudio = useCallback(async () => {
        const active = activeSoundRef.current;
        if (!active) return;
        try { await active.stopAsync(); } catch { }
        try { await active.setPositionAsync(0); } catch { }
        activeSoundRef.current = null;
        activeKeyRef.current = null;
    }, []);

    const resolveAudioUri = useCallback(async (source: string): Promise<string | null> => {
        const trimmed = source.trim();
        if (!trimmed) return null;
        if (isDataUri(trimmed) || isFileLikeUri(trimmed)) return trimmed;
        if (isWebUrl(trimmed)) {
            const storagePath = extractLibraryPathFromPublicUrl(trimmed);
            if (storagePath) {
                const signed = await getHookAudioSignedUrl(storagePath, 60 * 60);
                if (signed) return signed;
            }
            return trimmed;
        }
        if (isAbsoluteFilePath(trimmed)) return `file://${trimmed}`;
        if (isStoragePath(trimmed)) {
            const signed = await getHookAudioSignedUrl(trimmed, 60 * 60);
            return signed || trimmed;
        }
        return `data:audio/mpeg;base64,${trimmed}`;
    }, []);

    const getOrCreateSound = useCallback(async (key: string, source: string): Promise<Audio.Sound> => {
        const signature = getSignature(source);
        const cached = cacheRef.current.get(key);

        if (cached && cached.signature === signature) {
            return cached.sound;
        }

        if (cached) {
            try { await cached.sound.unloadAsync(); } catch { }
            cacheRef.current.delete(key);
        }

        const uri = await resolveAudioUri(source);
        if (!uri) {
            throw new Error('Could not resolve audio source URI');
        }

        const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: false, isLooping: false, progressUpdateIntervalMillis: 80 }
        );

        cacheRef.current.set(key, { signature, sound });
        return sound;
    }, [resolveAudioUri]);

    const primeAudio = useCallback(async (key: string, source: string) => {
        if (!source) return;
        await ensureAudioMode();
        await getOrCreateSound(key, source);
    }, [ensureAudioMode, getOrCreateSound]);

    const toggleAudio = useCallback(async ({ key, source, base64, onFinish }: ToggleAudioParams): Promise<ToggleAudioResult> => {
        const audioSource = source || base64;
        if (!audioSource) return 'stopped';

        await ensureAudioMode();
        const sound = await getOrCreateSound(key, audioSource);

        if (activeKeyRef.current === key && activeSoundRef.current) {
            const status = await activeSoundRef.current.getStatusAsync();
            if (status.isLoaded && status.isPlaying) {
                await stopAudio();
                return 'stopped';
            }
        }

        if (activeSoundRef.current && activeKeyRef.current !== key) {
            await stopAudio();
        }

        const playRequestedAt = Date.now();
        let latencyLogged = false;

        sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;
            if (!latencyLogged && status.isPlaying) {
                latencyLogged = true;
                console.log(`🎧 [AudioLatency] ${key}: ${Date.now() - playRequestedAt}ms`);
            }
            if (status.didJustFinish) {
                if (activeSoundRef.current === sound) {
                    activeSoundRef.current = null;
                    activeKeyRef.current = null;
                }
                onFinish?.();
            }
        });

        await sound.replayAsync();
        activeSoundRef.current = sound;
        activeKeyRef.current = key;
        return 'playing';
    }, [ensureAudioMode, getOrCreateSound, stopAudio]);

    const primeBase64Audio = useCallback(async (key: string, base64: string) => {
        await primeAudio(key, base64);
    }, [primeAudio]);

    const toggleBase64Audio = useCallback(async (params: ToggleAudioParams): Promise<ToggleAudioResult> => {
        return toggleAudio(params);
    }, [toggleAudio]);

    const releaseAllAudio = useCallback(async () => {
        await stopAudio();
        const cached = Array.from(cacheRef.current.values());
        await Promise.all(
            cached.map(async ({ sound }) => {
                try { await sound.unloadAsync(); } catch { }
            })
        );
        cacheRef.current.clear();
    }, [stopAudio]);

    useEffect(() => {
        return () => {
            releaseAllAudio().catch(() => { });
        };
    }, [releaseAllAudio]);

    const value = useMemo<AudioContextValue>(() => ({
        toggleAudio,
        primeAudio,
        toggleBase64Audio,
        stopAudio,
        primeBase64Audio,
        releaseAllAudio,
    }), [primeAudio, primeBase64Audio, releaseAllAudio, stopAudio, toggleAudio, toggleBase64Audio]);

    return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudio = () => useContext(AudioContext);
