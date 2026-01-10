/**
 * TEXTURED BACKGROUND
 *
 * Adds a white leather texture to all screens.
 *
 * IMPORTANT:
 * This texture must remain the *back-most* layer so it never covers videos or other
 * intentional visuals. Some screens may paint opaque backgrounds and hide it—those
 * screens should be adjusted individually if we want more texture visibility there.
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
      {/* Texture background (never blocks touches, never covers content/videos) */}
      <Image
        source={require('../../assets/images/white-leather-texture.jpg')}
        style={[StyleSheet.absoluteFill, styles.texture]}
        resizeMode="cover"
        pointerEvents="none"
      />
      {/* Content on top */}
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
  },
  content: {
    flex: 1,
  },
  texture: {
    opacity: 0.22,
  },
});
