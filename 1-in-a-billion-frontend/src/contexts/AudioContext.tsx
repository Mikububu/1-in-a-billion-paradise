/**
 * AUDIO CONTEXT - Global audio coordination for dual audio (narration + music)
 * 
 * State-of-the-art approach:
 * - Single source of truth for all audio playback
 * - Mutual exclusion: only one audio plays at a time (like Spotify/Audible)
 * - Smooth handoff between narration and music
 * - Prefetch support for iPhone compatibility
 */

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { getDocumentDirectory } from '../utils/fileSystem';
import { getLocalArtifactPaths } from '../services/artifactCacheService';

type AudioType = 'narration' | 'song';

interface AudioState {
  url: string;
  playableUrl: string; // Local file path if cached, otherwise remote URL
  type: AudioType;
  playing: boolean;
  loading: boolean;
  buffering: boolean;
  pos: number;
  dur: number;
  available: boolean | null; // null = checking, true = ready, false = not ready
  isLocal: boolean; // True if using local cached file
  downloadProgress: number; // 0-1, download progress when loading remote audio
}

interface AudioContextValue {
  // Current active audio
  activeType: AudioType | null;
  
  // State getters
  getState: (type: AudioType) => AudioState | null;
  
  // Actions
  registerAudio: (type: AudioType, url: string) => void;
  unregisterAudio: (type: AudioType) => void;
  togglePlayback: (type: AudioType) => Promise<void>;
  seek: (type: AudioType, positionSeconds: number) => Promise<void>;
  
  // For slider - optimistic updates
  startSeeking: (type: AudioType) => void;
  updateSeekPosition: (type: AudioType, pos: number) => void;
  finishSeeking: (type: AudioType, pos: number) => Promise<void>;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export const useAudioContext = () => {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudioContext must be used within AudioProvider');
  return ctx;
};

interface AudioInstance {
  url: string;
  sound: Audio.Sound | null;
  state: AudioState;
  seekingRef: React.MutableRefObject<boolean>;
  prefetchAbort: AbortController | null;
}

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeType, setActiveType] = useState<AudioType | null>(null);
  const [, forceUpdate] = useState(0);
  
  const instancesRef = useRef<Map<AudioType, AudioInstance>>(new Map());
  
  const rerender = useCallback(() => forceUpdate(n => n + 1), []);
  
  const createDefaultState = (url: string, type: AudioType): AudioState => ({
    url,
    playableUrl: url,
    type,
    playing: false,
    loading: false,
    buffering: false,
    pos: 0,
    dur: 0,
    available: null,
    isLocal: false,
    downloadProgress: 0,
  });
  
  // Parse jobId and docNum from URL like: /api/jobs/v2/{jobId}/audio/{docNum}
  const parseAudioUrl = (url: string): { jobId: string; docNum: number; isSong: boolean } | null => {
    const audioMatch = url.match(/\/jobs\/v2\/([^/]+)\/audio\/(\d+)/);
    if (audioMatch) {
      return { jobId: audioMatch[1], docNum: parseInt(audioMatch[2], 10), isSong: false };
    }
    const songMatch = url.match(/\/jobs\/v2\/([^/]+)\/song\/(\d+)/);
    if (songMatch) {
      return { jobId: songMatch[1], docNum: parseInt(songMatch[2], 10), isSong: true };
    }
    return null;
  };
  
  const updateState = useCallback((type: AudioType, patch: Partial<AudioState>) => {
    const instance = instancesRef.current.get(type);
    if (instance) {
      instance.state = { ...instance.state, ...patch };
      rerender();
    }
  }, [rerender]);
  
  const checkAudioAvailable = useCallback(async (type: AudioType, url: string, abort: AbortController) => {
    try {
      console.log(`🎵 Checking ${type} availability: ${url.substring(0, 60)}...`);
      
      // Step 1: Check local cache first (instant if cached)
      const parsed = parseAudioUrl(url);
      if (parsed) {
        const localPaths = await getLocalArtifactPaths(parsed.jobId);
        const docPaths = localPaths.get(parsed.docNum);
        const localPath = parsed.isSong ? docPaths?.songPath : docPaths?.audioPath;
        
        if (localPath) {
          console.log(`📱 ${type} found in local cache: ${localPath}`);
          if (!abort.signal.aborted) {
            updateState(type, { available: true, playableUrl: localPath, isLocal: true });
          }
          return;
        }
      }
      
      // Step 2: Not cached - check remote availability via HEAD
      const response = await fetch(url, { method: 'HEAD', signal: abort.signal });
      if (response.ok) {
        if (!abort.signal.aborted) {
          updateState(type, { available: true, playableUrl: url, isLocal: false });
          console.log(`✅ ${type} available (remote)`);
        }
      } else {
        if (!abort.signal.aborted) {
          updateState(type, { available: false });
          // Retry after 15s
          setTimeout(() => {
            const instance = instancesRef.current.get(type);
            if (instance && instance.url === url && !instance.state.available) {
              checkAudioAvailable(type, url, abort);
            }
          }, 15000);
        }
      }
    } catch (e: any) {
      if (!abort.signal.aborted) {
        console.log(`⏳ ${type} not yet available: ${e.message}`);
        updateState(type, { available: false });
        // Retry after 15s
        setTimeout(() => {
          const instance = instancesRef.current.get(type);
          if (instance && instance.url === url && !instance.state.available) {
            checkAudioAvailable(type, url, abort);
          }
        }, 15000);
      }
    }
  }, [updateState]);
  
  const stopOtherAudio = useCallback(async (keepType: AudioType) => {
    for (const [type, instance] of instancesRef.current.entries()) {
      if (type !== keepType) {
        // Stop any loaded sound
        if (instance.sound) {
          try {
            console.log(`🛑 Stopping ${type} for ${keepType}`);
            await instance.sound.stopAsync();
            await instance.sound.unloadAsync();
          } catch {}
          instance.sound = null;
        }
        // Also reset loading state so the other audio can be clicked again
        // Reset dur to 0 so slider resets to start position
        updateState(type, { playing: false, pos: 0, dur: 0, loading: false, downloadProgress: 0 });
      }
    }
    setActiveType(keepType);
  }, [updateState]);
  
  const registerAudio = useCallback((type: AudioType, url: string) => {
    // Clean up existing
    const existing = instancesRef.current.get(type);
    if (existing) {
      existing.prefetchAbort?.abort();
      existing.sound?.unloadAsync().catch(() => {});
    }
    
    const abort = new AbortController();
    const instance: AudioInstance = {
      url,
      sound: null,
      state: createDefaultState(url, type),
      seekingRef: { current: false },
      prefetchAbort: abort,
    };
    
    instancesRef.current.set(type, instance);
    rerender();
    
    // Start availability check
    checkAudioAvailable(type, url, abort);
  }, [checkAudioAvailable, rerender]);
  
  const unregisterAudio = useCallback((type: AudioType) => {
    const instance = instancesRef.current.get(type);
    if (instance) {
      instance.prefetchAbort?.abort();
      instance.sound?.unloadAsync().catch(() => {});
      instancesRef.current.delete(type);
      if (activeType === type) setActiveType(null);
      rerender();
    }
  }, [activeType, rerender]);
  
  const togglePlayback = useCallback(async (type: AudioType) => {
    const instance = instancesRef.current.get(type);
    if (!instance) return;
    
    // If already loaded, toggle play/pause INSTANTLY (no loading state)
    // Check this BEFORE stopping other audio to allow pause to work
    if (instance.sound) {
      try {
        // Get ACTUAL status from the sound object to avoid race conditions
        const status = await instance.sound.getStatusAsync();
        const isActuallyPlaying = status.isLoaded && status.isPlaying;
        
        console.log(`🎵 ${type} toggle: cached=${instance.state.playing}, actual=${isActuallyPlaying}`);
        
        if (isActuallyPlaying) {
          // PAUSE - update UI immediately, then pause audio
          console.log(`⏸️ Pausing ${type}...`);
          updateState(type, { playing: false });
          await instance.sound.pauseAsync();
          return;
        } else if (status.isLoaded) {
          // Resume - stop other audio first, then play
          await stopOtherAudio(type);
          console.log(`▶️ Resuming ${type}...`);
          updateState(type, { playing: true });
          await instance.sound.playAsync();
          return;
        }
      } catch (e) {
        // Sound might be in bad state, fall through to reload
        console.log(`⚠️ ${type} sound error, will reload:`, e);
        instance.sound = null;
      }
    }
    
    // Stop other audio before loading new audio
    await stopOtherAudio(type);
    
    // If THIS audio is already loading, ignore (prevent double-tap)
    if (instance.state.loading) return;
    
    updateState(type, { loading: true });
    
    try {
      // stopOtherAudio already called above
      
      let playUrl = instance.state.playableUrl || instance.url;
      const isLocal = instance.state.isLocal;
      
      // Set audio mode for better streaming performance
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      
      // If remote, download to temp file first for faster playback on iOS
      // iOS buffers the entire file anyway, so downloading first is actually faster
      if (!isLocal && playUrl.startsWith('http')) {
        console.log(`📥 Downloading ${type} audio for faster playback...`);
        const docDir = getDocumentDirectory() || '';
        // Preserve original file extension for proper iOS playback
        // Songs are .mp3 (Minimax), narration is .m4a (Chatterbox TTS)
        const urlExt = playUrl.match(/\.(mp3|m4a|wav|aac)(\?|$)/i)?.[1];
        const ext = urlExt || (type === 'song' ? 'mp3' : 'm4a');
        const tempPath = `${docDir}temp_${type}_${Date.now()}.${ext}`;
        try {
          // Use createDownloadResumable for progress tracking
          const downloadResumable = FileSystem.createDownloadResumable(
            playUrl,
            tempPath,
            {},
            (progress) => {
              const pct = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
              updateState(type, { downloadProgress: pct });
              if (progress.totalBytesWritten % 500000 < 50000) { // Log every ~500KB
                console.log(`📥 ${type} download: ${Math.round(pct * 100)}%`);
              }
            }
          );
          const result = await downloadResumable.downloadAsync();
          if (result?.status === 200) {
            playUrl = result.uri;
            console.log(`✅ Downloaded ${type} to temp file`);
          }
          updateState(type, { downloadProgress: 1 });
        } catch (e) {
          console.log(`⚠️ Download failed, falling back to streaming`);
          updateState(type, { downloadProgress: 0 });
        }
      }
      
      console.log(`🔄 Loading ${type} audio from ${isLocal ? 'local cache' : 'temp file'}...`);
      const { sound } = await Audio.Sound.createAsync(
        { uri: playUrl },
        { 
          shouldPlay: true, 
          progressUpdateIntervalMillis: 100,
          androidImplementation: 'MediaPlayer',
        },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          
          const inst = instancesRef.current.get(type);
          if (!inst) return;
          
          // Don't update position while user is scrubbing
          if (!inst.seekingRef.current) {
            updateState(type, { pos: status.positionMillis / 1000 });
          }
          
          updateState(type, {
            playing: status.isPlaying,
            buffering: !!(status as any).isBuffering,
            dur: status.durationMillis ? status.durationMillis / 1000 : 0,
          });
          
          if (status.didJustFinish) {
            updateState(type, { playing: false });
            setActiveType(null);
          }
        },
        false
      );
      
      instance.sound = sound;
      updateState(type, { playing: true, loading: false });
      console.log(`✅ ${type} playback started`);
      
    } catch (e: any) {
      console.error(`❌ ${type} playback error:`, e.message);
      updateState(type, { playing: false, loading: false });
    }
  }, [stopOtherAudio, updateState]);
  
  const seek = useCallback(async (type: AudioType, positionSeconds: number) => {
    const instance = instancesRef.current.get(type);
    if (instance?.sound) {
      await instance.sound.setPositionAsync(positionSeconds * 1000);
      updateState(type, { pos: positionSeconds });
    }
  }, [updateState]);
  
  const startSeeking = useCallback((type: AudioType) => {
    const instance = instancesRef.current.get(type);
    if (instance) {
      instance.seekingRef.current = true;
    }
  }, []);
  
  const updateSeekPosition = useCallback((type: AudioType, pos: number) => {
    updateState(type, { pos });
  }, [updateState]);
  
  const finishSeeking = useCallback(async (type: AudioType, pos: number) => {
    const instance = instancesRef.current.get(type);
    if (instance) {
      instance.seekingRef.current = false;
      await seek(type, pos);
    }
  }, [seek]);
  
  const getState = useCallback((type: AudioType): AudioState | null => {
    return instancesRef.current.get(type)?.state || null;
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const instance of instancesRef.current.values()) {
        instance.prefetchAbort?.abort();
        instance.sound?.unloadAsync().catch(() => {});
      }
    };
  }, []);
  
  const value: AudioContextValue = {
    activeType,
    getState,
    registerAudio,
    unregisterAudio,
    togglePlayback,
    seek,
    startSeeking,
    updateSeekPosition,
    finishSeeking,
  };
  
  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};
