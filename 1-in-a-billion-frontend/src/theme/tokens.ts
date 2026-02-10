// ═══════════════════════════════════════════════════════════════════════════
// VINTAGE TINT - Change this ONE value to adjust warmth across ALL screens
// ═══════════════════════════════════════════════════════════════════════════
const VINTAGE_TINT = 'rgba(252, 248, 235, 0.88)'; // Warm vintage cream background

// ═══════════════════════════════════════════════════════════════════════════
// CARD/BUTTON COLOR - Change this ONE value for all cards, buttons, and inputs
// ═══════════════════════════════════════════════════════════════════════════
const CARD_SURFACE = '#ECEAE6'; // Off-white grey for all cards, buttons, and inputs

export const colors = {
  background: VINTAGE_TINT,
  // Canonical "broken white" surfaces for cards + inputs (keep neutral so they pop)
  surface: CARD_SURFACE,
  text: '#1A1A1A',
  mutedText: '#6B6B6B',
  divider: '#ECEAE6',
  border: '#E8E6E2',
  primary: '#d10000',
  primarySoft: '#FFF2F2',
  accentSoft: 'rgba(209, 0, 0, 0.06)',
  cardStroke: 'rgba(30, 25, 20, 0.05)',
  highlightYellow: '#FACC15',
  inputBg: CARD_SURFACE,
  // Canonical "black stroke" for input fields
  inputStroke: 'rgba(26, 26, 26, 0.45)',
  success: '#10B981',
  warning: '#F97316',
  error: '#EF4444',
  buttonBg: CARD_SURFACE, // All cards, buttons, and inputs use the same color
};

export const typography = {
  headline: 'PlayfairDisplay_700Bold',
  serif: 'PlayfairDisplay_400Regular',
  serifBold: 'PlayfairDisplay_700Bold',
  serifSemiBold: 'PlayfairDisplay_600SemiBold',
  sansRegular: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_600SemiBold',
  sansExtraBold: 'Inter_600SemiBold',
};

export const radii = {
  card: 22,
  button: 999,
  input: 16,
  pill: 14,
  lg: 18,
  xl: 24,
  modal: 20, // NEW: Modal border radius
};

export const spacing = {
  page: 20,
  stack: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  md: 16,
  sm: 12,
  xs: 6,
};

// Layout primitives (single source of truth)
export const layout = {
  // Global back button position (safe-area aware). Adjust these two values to move
  // the back button everywhere in the app.
  backButtonOffsetTop: spacing.sm,
  backButtonOffsetLeft: spacing.page,
};

export const shadows = {
  card: {
    shadowColor: 'rgba(17, 17, 17, 0.12)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.15,
    shadowRadius: 36,
    elevation: 12,
  },
};

export const tokens = {
  colors,
  typography,
  radii,
  spacing,
  layout,
  shadows,
};
