import { useRef, useState, useEffect } from 'react';
import { ScrollView } from 'react-native';

interface UseTextAutoScrollOptions {
  playing: boolean;
  seeking: boolean;
  pos: number;
  dur: number;
}

export const useTextAutoScroll = ({ playing, seeking, pos, dur }: UseTextAutoScrollOptions) => {
  const scrollRef = useRef<ScrollView | null>(null);
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);

  // Auto-scroll effect
  useEffect(() => {
    if (!scrollRef.current) return;
    if (!viewportH || !contentH) return;

    // Scroll while playing OR scrubbing (seeking). Only reset when idle.
    if (!dur || (!playing && !seeking)) {
      scrollRef.current.scrollTo({ y: 0, animated: false });
      return;
    }

    const progress = Math.max(0, Math.min(1, pos / dur));
    const maxScrollY = Math.max(0, contentH - viewportH);
    const y = maxScrollY * progress;
    scrollRef.current.scrollTo({ y, animated: false });
  }, [playing, seeking, pos, dur, viewportH, contentH]);

  return {
    scrollRef,
    setViewportH,
    setContentH,
  };
};
