/**
 * SYNC STATUS INDICATOR
 * 
 * A small indicator that shows the current sync status.
 * Can be placed in settings, header, or anywhere sync status should be visible.
 * 
 * Usage:
 * <SyncStatusIndicator />
 * <SyncStatusIndicator showText />
 * <SyncStatusIndicator compact />
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSyncStore, getSyncStatusText, getSyncStatusColor, getSyncWarningMessage, SyncStatus } from '@/store/syncStore';
import { colors, typography, spacing } from '@/theme/tokens';

interface SyncStatusIndicatorProps {
  // Show text description alongside icon
  showText?: boolean;
  // Compact mode - just the dot
  compact?: boolean;
  // Custom style
  style?: object;
  // Callback when tapped
  onPress?: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  showText = false,
  compact = false,
  style,
  onPress,
}) => {
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const isOnline = useSyncStore((s) => s.isOnline);
  
  // Don't show anything if idle (not signed in)
  if (status === 'idle') return null;
  
  const statusColor = getSyncStatusColor(status);
  const statusText = getSyncStatusText(status, lastSyncedAt);
  
  const content = (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {status === 'syncing' ? (
        <ActivityIndicator size="small" color={statusColor} style={styles.spinner} />
      ) : (
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
      )}
      
      {showText && !compact && (
        <Text style={[styles.text, { color: statusColor }]}>
          {statusText}
        </Text>
      )}
    </View>
  );
  
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  
  return content;
};

// Larger version for settings screen
export const SyncStatusCard: React.FC = () => {
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const errorMessage = useSyncStore((s) => s.errorMessage);
  const failureCount = useSyncStore((s) => s.failureCount);
  const isOnline = useSyncStore((s) => s.isOnline);
  
  const statusColor = getSyncStatusColor(status);
  const statusText = getSyncStatusText(status, lastSyncedAt);
  const warningMessage = getSyncWarningMessage(lastSyncedAt, status);
  
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          {status === 'syncing' ? (
            <ActivityIndicator size="small" color={statusColor} style={styles.cardSpinner} />
          ) : (
            <View style={[styles.cardDot, { backgroundColor: statusColor }]} />
          )}
          <Text style={styles.cardTitle}>Cloud Backup</Text>
        </View>
        <Text style={[styles.cardStatus, { color: statusColor }]}>{statusText}</Text>
      </View>
      
      {/* 24-hour warning */}
      {warningMessage && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>{warningMessage}</Text>
        </View>
      )}
      
      {!isOnline && !warningMessage && (
        <Text style={styles.cardWarning}>
          Your device is offline. Changes will sync when you're back online.
        </Text>
      )}
      
      {status === 'error' && errorMessage && (
        <Text style={styles.cardError}>
          {errorMessage}
          {failureCount > 1 && ` (retry ${failureCount})`}
        </Text>
      )}
      
      {lastSyncedAt && status !== 'syncing' && (
        <Text style={styles.cardLastSync}>
          Last backup: {new Date(lastSyncedAt).toLocaleString()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  containerCompact: {
    padding: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  spinner: {
    width: 12,
    height: 12,
  },
  text: {
    marginLeft: 6,
    fontSize: 12,
    fontFamily: typography.sansRegular,
  },
  
  // Card styles
  card: {
    backgroundColor: colors.cardBackground || '#f5f5f5',
    borderRadius: 12,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  cardSpinner: {
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: typography.sansMedium,
    color: colors.text,
  },
  cardStatus: {
    fontSize: 14,
    fontFamily: typography.sansRegular,
  },
  cardWarning: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: typography.sansRegular,
    color: '#f59e0b',
  },
  cardError: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: typography.sansRegular,
    color: '#ef4444',
  },
  cardLastSync: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: typography.sansRegular,
    color: colors.mutedText,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: typography.sansRegular,
    color: '#92400e',
    lineHeight: 18,
  },
});
