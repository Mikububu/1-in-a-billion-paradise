import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';

interface AnimatedSystemIconProps {
    icon: string;
    size?: number;
    style?: any;
}

export const AnimatedSystemIcon = ({ icon, size = 28, style }: AnimatedSystemIconProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const colorAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulsing scale animation
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.15,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );

        // Subtle rotation animation
        const rotateAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 3000,
                    useNativeDriver: true,
                }),
                Animated.timing(rotateAnim, {
                    toValue: 0,
                    duration: 3000,
                    useNativeDriver: true,
                }),
            ])
        );

        // Color oscillation
        const colorAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(colorAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: false,
                }),
                Animated.timing(colorAnim, {
                    toValue: 0,
                    duration: 2000,
                    useNativeDriver: false,
                }),
            ])
        );

        pulseAnimation.start();
        rotateAnimation.start();
        colorAnimation.start();

        return () => {
            pulseAnimation.stop();
            rotateAnimation.stop();
            colorAnimation.stop();
        };
    }, [scaleAnim, rotateAnim, colorAnim]);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['-5deg', '5deg'],
    });

    // Interpolate between black and primary color
    const textColor = colorAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ['#000000', colors.primary, '#000000'],
    });

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { scale: scaleAnim },
                        { rotate: rotation },
                    ],
                },
            ]}
        >
            <Animated.Text
                style={[
                    styles.icon,
                    {
                        fontSize: size,
                        color: textColor,
                    },
                    style,
                ]}
            >
                {icon}
            </Animated.Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        textAlign: 'center',
        textShadowColor: 'rgba(255, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
    },
});
