/**
 * COUNTDOWN OVERLAY COMPONENT
 * 
 * Shows a countdown timer overlay when reading media is not ready.
 * Countdown is based on job creation time, not screen visit time.
 * 
 * Usage:
 * <CountdownOverlay jobId={jobId} allMediaReady={allMediaReady} />
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { env } from '@/config/env';
import { colors, spacing, typography } from '@/theme/tokens';

interface CountdownOverlayProps {
  jobId: string;
  allMediaReady: boolean;
}

// ESTIMATED DURATION: 45 minutes per reading (conservative estimate)
// This is the ONLY place we define this - change here to update everywhere
const ESTIMATED_DURATION_SECONDS = 45 * 60;

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ jobId, allMediaReady }) => {
  const [jobCreatedAt, setJobCreatedAt] = useState<Date | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch job creation time on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/${jobId}`);
        if (!res.ok) return;
        const payload = await res.json();
        const createdAt = payload?.job?.created_at;
        if (createdAt && mounted) {
          setJobCreatedAt(new Date(createdAt));
        }
      } catch (error) {
        console.error('Failed to fetch job creation time:', error);
      }
    })();
    return () => { mounted = false; };
  }, [jobId]);

  // Countdown timer - based on job creation time
  useEffect(() => {
    if (allMediaReady || !jobCreatedAt) {
      // Stop countdown when ready or if we don't have job creation time
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdownSeconds(0);
      return;
    }

    // Calculate countdown based on job creation time
    const estimatedCompletionTime = new Date(jobCreatedAt.getTime() + ESTIMATED_DURATION_SECONDS * 1000);
    
    const updateCountdown = () => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((estimatedCompletionTime.getTime() - now.getTime()) / 1000));
      setCountdownSeconds(remaining);
      
      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    };

    // Update immediately
    updateCountdown();

    // Then update every second
    if (!countdownIntervalRef.current) {
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [allMediaReady, jobCreatedAt]);

  // Format countdown time
  const countdownDisplay = useMemo(() => {
    if (countdownSeconds <= 0) return '0:00';
    const mins = Math.floor(countdownSeconds / 60);
    const secs = countdownSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [countdownSeconds]);

  // Don't show if media is ready or countdown is 0
  if (allMediaReady || countdownSeconds <= 0) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card} pointerEvents="auto">
        <Text style={styles.label}>Approximate time remaining</Text>
        <Text style={styles.time}>{countdownDisplay}</Text>
        <Text style={styles.subtext}>until your reading is ready</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 80,
    zIndex: 50,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    minWidth: 200,
    maxWidth: 240,
  },
  label: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  time: {
    fontFamily: typography.headline,
    fontSize: 36,
    color: colors.primary,
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtext: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
