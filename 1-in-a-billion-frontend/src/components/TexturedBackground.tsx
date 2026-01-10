/**
 * TEXTURED BACKGROUND
 *
 * Adds a white leather texture to all screens.
 *
 * IMPORTANT:
 * Many screens render an opaque background color. If we put the texture "behind" children,
 * it will be fully hidden. So we render the texture as a subtle overlay (pointerEvents off),
 * which makes it consistently visible app-wide while keeping readability.
 */

import { StyleSheet, View, Image } from 'react-native';
import { colors } from '@/theme/tokens';

type Props = {
  children: React.ReactNode;
  style?: object;
};

/**
 * Main textured background component
 * Uses actual leather texture image with 30% opacity over base background color
 */
export const TexturedBackground = ({ children, style }: Props) => {
  return (
    <View style={[styles.container, style]}>
      {/* Content on top */}
      <View style={styles.content}>
        {children}
      </View>
      {/* Texture overlay (subtle, never blocks touches) */}
      <Image
        source={require('../../assets/images/white-leather-texture.jpg')}
        style={[StyleSheet.absoluteFill, styles.texture]}
        resizeMode="cover"
        pointerEvents="none"
      />
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
  },
  content: {
    flex: 1,
  },
  texture: {
    opacity: 0.14,
  },
});
