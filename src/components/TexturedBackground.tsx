import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';

type Props = {
    children: React.ReactNode;
    style?: object;
};

export const TexturedBackground = ({ children, style }: Props) => {
    return (
        <View style={[styles.container, style]}>
            <Image
                source={require('../../assets/images/white-leather-texture.jpg')}
                style={[StyleSheet.absoluteFill, styles.texture]}
                resizeMode="cover"
            />
            <View style={styles.content}>{children}</View>
        </View>
    );
};

export const LeatherBackground = TexturedBackground;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Single global tint control from theme tokens (VINTAGE_TINT).
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
    },
    texture: {
        opacity: 0.38,
    },
});
