import { SimpleSlider } from '@/components/SimpleSlider';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { describeIntensity } from '@/utils/intensity';
import { colors, spacing, typography } from '@/theme/tokens';

// Lazy load expo-haptics
let Haptics: typeof import('expo-haptics') | null = null;
try {
  Haptics = require('expo-haptics');
} catch (e) {
  console.warn('expo-haptics not available');
}

type IntensitySliderProps = {
  value: number;
  onChange: (next: number) => void;
};

export const IntensitySlider = ({ value, onChange }: IntensitySliderProps) => {
  const lastValue = useRef(value);
  const descriptor = describeIntensity(value);

  const handleValueChange = (nextValue: number) => {
    if (Math.abs(nextValue - lastValue.current) >= 1) {
      Haptics?.selectionAsync();
      lastValue.current = nextValue;
    }
    onChange(Math.round(nextValue));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Safe</Text>
        <Text style={styles.legendLabel}>Spicy</Text>
      </View>
      <SimpleSlider
        minimumValue={0}
        maximumValue={10}
        // step={1}
        value={value}
        // minimumTrackTintColor={colors.primary}
        // maximumTrackTintColor={colors.primarySoft}
        // thumbTintColor={colors.primary}
        onValueChange={handleValueChange}
      />
      <View style={styles.caption}>
        <Text style={styles.valueBadge}>{value}</Text>
        <Text style={styles.captionText}>{descriptor.caption}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    padding: spacing.lg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardStroke,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  caption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    color: colors.background,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
  },
  captionText: {
    flex: 1,
    textAlign: 'right',
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.text,
  },
});

