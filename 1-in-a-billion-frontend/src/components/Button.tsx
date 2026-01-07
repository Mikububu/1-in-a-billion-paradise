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
    borderColor: colors.text,
  },
  secondary: {
    backgroundColor: colors.background,
    borderColor: colors.text,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.divider,
  },
};

const variantTextColors: Record<ButtonVariant, string> = {
  primary: '#FFFFFF',
  secondary: colors.text,
  ghost: colors.text,
};

export const Button = ({ label, onPress, disabled, loading, variant = 'primary', style, fitContent }: ButtonProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        fitContent && styles.fitContent,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantTextColors[variant]} />
      ) : (
        <Text style={[styles.label, { color: variantTextColors[variant] }]}>{label}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    borderRadius: radii.button,
    alignItems: 'center',
    borderWidth: 1,
  },
  fitContent: {
    alignSelf: 'center',
    paddingHorizontal: 32,
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    letterSpacing: 0.4,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
});

