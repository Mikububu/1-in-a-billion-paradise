import { TextStyle } from 'react-native';
import { colors, typography } from './tokens';

type TypoPreset = Record<string, TextStyle>;

export const textPresets: TypoPreset = {
  headline: {
    fontFamily: typography.serifBold,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
  },
  subheadline: {
    fontFamily: typography.serifSemiBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
  },
  body: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  caption: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    lineHeight: 18,
    color: colors.mutedText,
  },
  button: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.background,
    letterSpacing: 0.5,
  },
};

