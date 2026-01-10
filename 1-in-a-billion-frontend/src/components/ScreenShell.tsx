import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';

type ScreenShellProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  readMoreSlot?: ReactNode;
  screenId?: string | number; // Cheat screen number for debugging
  titleAlign?: 'left' | 'center';
  subtitleAlign?: 'left' | 'center';
  onBack?: () => void;
  contentPaddingTop?: number;
  bodyMarginTop?: number;
};

export const ScreenShell = ({
  title,
  subtitle,
  children,
  footer,
  screenId,
  titleAlign = 'left',
  subtitleAlign = 'left',
  onBack,
  contentPaddingTop = 120,
  bodyMarginTop,
}: ScreenShellProps) => {
  return (
    <SafeAreaView style={styles.root}>
      {/* Back Button */}
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      {/* Screen ID - positioned under D button */}
      {screenId !== undefined ? null : null}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: contentPaddingTop }]}
        showsVerticalScrollIndicator={false}
      >
        {title ? (
          <Text style={[styles.title, titleAlign === 'center' && styles.titleCenter]} selectable>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.subtitle, subtitleAlign === 'center' && styles.subtitleCenter]} selectable>
            {subtitle}
          </Text>
        ) : null}
        <View style={[styles.body, bodyMarginTop ? { marginTop: bodyMarginTop } : null]}>
          {children}
        </View>
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: spacing.page,
    zIndex: 10,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: 120,
    paddingBottom: spacing.xl,
  },
  body: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl, // Match IntroScreen's paddingVertical: spacing.xl = 32px
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 26,
    lineHeight: 32,
    color: colors.text,
  },
  titleCenter: {
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.sm,
    fontFamily: typography.sansRegular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.mutedText,
  },
  subtitleCenter: {
    textAlign: 'center',
  },
  screenId: {
    position: 'absolute',
    top: 95, // Below D button (which is at top: 55, height: 36)
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
});

