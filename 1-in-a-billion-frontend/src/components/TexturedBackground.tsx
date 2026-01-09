/**
 * TEXTURED BACKGROUND
 * 
 * Adds a white leather texture to all backgrounds.
 * Uses the white-leather-texture.jpg image as the app-wide background with 30% opacity.
 */

import { StyleSheet, View, ImageBackground } from 'react-native';
import { colors } from '@/theme/tokens';

type Props = {
  children: React.ReactNode;
  style?: object;
};

/**
 * Main textured background component
 * Uses actual leather texture image with 30% opacity
 */
export const TexturedBackground = ({ children, style }: Props) => {
  return (
    <View style={[styles.container, style]}>
      <ImageBackground
        source={require('../../assets/images/white-leather-texture.jpg')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        imageStyle={{ opacity: 0.3 }}
      />
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
});
