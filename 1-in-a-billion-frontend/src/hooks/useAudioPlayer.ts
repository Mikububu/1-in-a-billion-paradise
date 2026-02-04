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
  const [available, setAvailable] = useState<boolean | null>(null); // null = checking, true = ready, false = not ready

  // Check if audio file exists (HEAD request - fast)
  // expo-av handles streaming/buffering when playback starts
  useEffect(() => {
    let cancelled = false;
    let retryTimer: NodeJS.Timeout | null = null;
    
    const checkAvailability = async (isRetry = false) => {
      if (!audioUrl) {
        console.warn('⚠️ useAudioPlayer: No audioUrl provided');
        setAvailable(false);
        return;
      }
      if (!isRetry) setAvailable(null);
      try {
        console.log(`🎵 ${isRetry ? 'Retrying' : 'Checking'} audio: ${audioUrl.substring(0, 60)}...`);
        // HEAD request - just check if file exists, don't download
        const response = await fetch(audioUrl, { method: 'HEAD' });
        if (cancelled) return;
        if (response.ok) {
          setAvailable(true);
          console.log(`✅ Audio available (HEAD check passed)`);
        } else {
          console.log(`⏳ Audio not yet available: ${response.status}`);
          setAvailable(false);
          if (!cancelled) {
            retryTimer = setTimeout(() => checkAvailability(true), 15000);
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        console.log(`⏳ Audio check failed: ${e.message}`);
        setAvailable(false);
        if (!cancelled) {
          retryTimer = setTimeout(() => checkAvailability(true), 15000);
        }
      }
    };
    checkAvailability();
    return () => { 
      cancelled = true; 
      if (retryTimer) clearTimeout(retryTimer);
    };
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
    if (loading) {
      console.log('⏳ Audio already loading, ignoring...');
      return;
    }
    if (!audioUrl) {
      console.error('❌ No audioUrl provided to togglePlayback');
      return;
    }

    try {
      setLoading(true);
      console.log(`🎵 Toggling playback: ${audioUrl.substring(0, 80)}...`);

      // Pause/resume if already loaded
      if (soundRef.current) {
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded && st.isPlaying) {
          console.log('⏸️ Pausing audio');
          await soundRef.current.pauseAsync();
          setPlaying(false);
          setLoading(false);
          return;
        }
        if (st.isLoaded) {
          console.log('▶️ Resuming audio');
          await soundRef.current.playAsync();
          setPlaying(true);
          setLoading(false);
          return;
        }
      }

      // Fresh load (STREAM ONLY)
      console.log('🔄 Loading fresh audio...');
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
      console.log('✅ Audio playback started');
    } catch (e: any) {
      console.error('❌ Audio playback error:', e.message, e);
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
    available, // null = checking, true = ready, false = not ready yet
    // Actions
    togglePlayback,
    handleSlidingStart,
    handleValueChange,
    handleSlidingComplete,
  };
};
