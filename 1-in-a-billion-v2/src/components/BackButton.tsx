import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, spacing, typography, colors } from '@/theme/tokens';

type BackButtonProps = {
    onPress: () => void;
    label?: string;
};

/**
 * Global back button (single source of truth).
 * - Safe-area aware
 * - No background (per design)
 * - Position controlled via `tokens.layout.backButtonOffsetTop/Left`
 */
export const BackButton = ({ onPress, label = '← Back' }: BackButtonProps) => {
    const insets = useSafeAreaInsets();

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.button, { top: insets.top + layout.backButtonOffsetTop, left: layout.backButtonOffsetLeft }]}
        >
            <Text style={styles.text}>{label}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        position: 'absolute',
        zIndex: 50,
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.sm,
        backgroundColor: 'transparent',
    },
    text: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
    },
});
