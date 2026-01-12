import { useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';

interface UseAudioPlayerOptions {
  audioUrl: string;
  onPlaybackEnd?: () => void;
}

export const useAudioPlayer = ({ audioUrl, onPlaybackEnd }: UseAudioPlayerOptions) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const seekingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [seeking, setSeeking] = useState(false);

  // Preload duration when URL changes
  useEffect(() => {
    const preloadDuration = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          setDur(status.durationMillis / 1000);
        }
        await sound.unloadAsync();
      } catch (e) {
        // Silently fail - user can still play audio normally
      }
    };
    preloadDuration();
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const togglePlayback = async () => {
    if (loading) return;

    try {
      setLoading(true);

      // Pause/resume if already loaded
      if (soundRef.current) {
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded && st.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlaying(false);
          return;
        }
        if (st.isLoaded) {
          await soundRef.current.playAsync();
          setPlaying(true);
          return;
        }
      }

      // Fresh load (STREAM ONLY)
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        (st) => {
          if (!st.isLoaded) return;
          setPlaying(st.isPlaying);
          setBuffering(!!(st as any).isBuffering);
          if (!seekingRef.current) setPos(st.positionMillis / 1000);
          setDur(st.durationMillis ? st.durationMillis / 1000 : 0);
          if (st.didJustFinish) {
            setPlaying(false);
            if (onPlaybackEnd) onPlaybackEnd();
          }
        },
        false
      );
      soundRef.current = sound;
      setPlaying(true);
    } catch (e: any) {
      console.error('Audio playback error:', e);
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSlidingStart = () => {
    seekingRef.current = true;
    setSeeking(true);
  };

  const handleValueChange = (v: number) => {
    setPos(v);
  };

  const handleSlidingComplete = async (v: number) => {
    seekingRef.current = false;
    setSeeking(false);
    setPos(v);
    await soundRef.current?.setPositionAsync(v * 1000).catch(() => {});
  };

  return {
    // State
    playing,
    loading,
    buffering,
    pos,
    dur,
    seeking,
    // Actions
    togglePlayback,
    handleSlidingStart,
    handleValueChange,
    handleSlidingComplete,
  };
};
