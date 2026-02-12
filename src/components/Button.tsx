import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, typography, radii } from '@/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: ButtonVariant;
    style?: StyleProp<ViewStyle>;
    fitContent?: boolean;
};

const variantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: {
        backgroundColor: colors.primary,
        borderWidth: 0,
    },
    secondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.text,
    },
    ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
};

const textStyles: Record<ButtonVariant, object> = {
    primary: {
        color: colors.background,
    },
    secondary: {
        color: colors.text,
    },
    ghost: {
        color: colors.textDim,
    },
};

export function Button({
    label,
    onPress,
    disabled,
    loading,
    variant = 'primary',
    style,
    fitContent,
}: ButtonProps) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.button,
                variantStyles[variant],
                fitContent && styles.fitContent,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'primary' ? colors.background : colors.text} />
            ) : (
                <Text style={[styles.text, textStyles[variant]]}>{label}</Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        height: 52,
        borderRadius: radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        paddingHorizontal: 24,
        minWidth: 120,
    },
    fitContent: {
        minWidth: 0,
        alignSelf: 'flex-start',
    },
    text: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    disabled: {
        opacity: 0.5,
    },
    pressed: {
        transform: [{ scale: 0.98 }],
        opacity: 0.9,
    },
});
