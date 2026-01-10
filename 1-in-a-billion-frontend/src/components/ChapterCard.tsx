import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '@/theme/tokens';

// Helper for status colors
const getStatusColor = (status: string) => {
    switch (status) {
        case 'complete': return colors.success;
        case 'generating_audio': return colors.primary;
        case 'generating_pdf': return colors.warning;
        case 'error': return colors.error;
        default: return colors.mutedText;
    }
};

export interface Chapter {
    id: string;
    number: number;
    name: string;
    system: string;
    systemId?: string;
    description: string;
    status: 'pending' | 'generating_text' | 'generating_audio' | 'generating_pdf' | 'complete' | 'error';
    textProgress: number;
    audioProgress: number;
    pdfProgress: number;
    audioDuration?: number; // seconds
    pdfPages?: number;
    audioUrl?: string; // Local/Remote path
    pdfUrl?: string; // Local/Remote path
    headlineText?: string;
    systemBlurbText?: string;
}

interface ChapterCardProps {
    chapter: Chapter;
    onDownloadPDF: () => void;
}

export const ChapterCard = ({ chapter, onDownloadPDF }: ChapterCardProps) => {
    const isComplete = chapter.status === 'complete';
    const isGenerating = chapter.status.startsWith('generating');
    const hasPdf = !!chapter.pdfUrl || chapter.pdfProgress >= 100;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={styles.number}>{chapter.number}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{chapter.name}</Text>
                        <Text style={styles.system}>{chapter.system}</Text>
                    </View>
                </View>
                {/* Status Indicator */}
                <View style={styles.statusContainer}>
                    {isGenerating && <ActivityIndicator size="small" color={getStatusColor(chapter.status)} />}
                    {isComplete && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
                </View>
            </View>

            <Text style={styles.description}>{chapter.description}</Text>

            {/* Progress Bars if generating */}
            {isGenerating && (
                <View style={styles.progressContainer}>
                    {/* Simple unified progress bar for now */}
                    <View style={[styles.progressBar, { width: `${chapter.pdfProgress}%`, backgroundColor: getStatusColor(chapter.status) }]} />
                </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
                {hasPdf && (
                    <Pressable onPress={onDownloadPDF} style={styles.actionButton}>
                        <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                        <Text style={styles.actionText}>Read PDF</Text>
                    </Pressable>
                )}
                {chapter.audioProgress >= 100 && (
                    <View style={styles.badge}>
                        <Ionicons name="headset-outline" size={12} color={colors.text} />
                        <Text style={styles.badgeText}>{Math.round((chapter.audioDuration || 0) / 60)} min</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        padding: spacing.md,
        marginBottom: spacing.md,
        marginHorizontal: spacing.page,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.xs,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    number: {
        fontFamily: typography.headline,
        fontSize: 18,
        color: colors.mutedText,
        marginRight: spacing.md,
        width: 24,
    },
    title: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    system: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 2,
    },
    statusContainer: {
        marginLeft: spacing.sm,
    },
    description: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.text,
        marginTop: spacing.xs,
        marginBottom: spacing.md,
        lineHeight: 20,
    },
    progressContainer: {
        height: 4,
        backgroundColor: '#F0F0F0',
        borderRadius: 2,
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: spacing.sm,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 4,
    },
    actionText: {
        fontFamily: typography.sansMedium,
        fontSize: 14,
        color: colors.primary,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    badgeText: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.text,
    },
});
