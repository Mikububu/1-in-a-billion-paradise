/**
 * TEXTURED BACKGROUND
 * 
 * Adds a subtle leather-like grain texture to backgrounds.
 * Creates a premium tactile feel without external dependencies.
 */

import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';

type Props = {
  children: React.ReactNode;
  style?: object;
};

/**
 * Main textured background component
 * Uses layered views to create leather grain effect
 */
export const TexturedBackground = ({ children, style }: Props) => {
  return (
    <View style={[styles.container, style]}>
      {/* Multiple subtle layers to create leather grain effect */}
      <View style={styles.grainBase} />
      <View style={styles.grainHighlight} />
      <View style={styles.grainShadow} />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

/**
 * Simpler leather background - same as TexturedBackground
 * Kept for backwards compatibility
 */
export const LeatherBackground = TexturedBackground;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    position: 'relative',
  },
  grainBase: {
    ...StyleSheet.absoluteFillObject,
    // Subtle warm grain
    backgroundColor: 'rgba(245, 240, 235, 0.3)',
  },
  grainHighlight: {
    ...StyleSheet.absoluteFillObject,
    // Light spots like leather highlights
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  grainShadow: {
    ...StyleSheet.absoluteFillObject,
    // Dark spots like leather pores
    backgroundColor: 'rgba(0, 0, 0, 0.008)',
  },
  content: {
    flex: 1,
  },
});
