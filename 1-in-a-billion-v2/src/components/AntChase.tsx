import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type Props = {
    /**
     * Visual size of the chase area. Keep small so it stays in "white space".
     */
    width?: number;
    height?: number;
};

function buildLoopPoints(width: number, height: number, a: number, b: number) {
    const cx = width / 2;
    const cy = height / 2;
    const n = 64;
    const input: number[] = [];
    const x: number[] = [];
    const y: number[] = [];
    const rot: string[] = [];

    for (let i = 0; i <= n; i++) {
        const t = i / n; // 0..1
        const theta = t * Math.PI * 2;
        const px = cx + a * Math.cos(theta);
        const py = cy + b * Math.sin(theta);
        // Tangent direction for body orientation
        const dx = -a * Math.sin(theta);
        const dy = b * Math.cos(theta);
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI;

        input.push(t);
        x.push(px);
        y.push(py);
        rot.push(`${deg}deg`);
    }

    return { input, x, y, rot };
}

function Walker({
    t,
    color,
    points,
    gait,
}: {
    t: Animated.Value;
    color: string;
    points: ReturnType<typeof buildLoopPoints>;
    gait: Animated.Value;
}) {
    const tx = t.interpolate({ inputRange: points.input, outputRange: points.x });
    const ty = t.interpolate({ inputRange: points.input, outputRange: points.y });
    const bodyRot = t.interpolate({ inputRange: points.input, outputRange: points.rot });
    const legRot = gait.interpolate({ inputRange: [0, 1], outputRange: ['-22deg', '22deg'] });
    const legRot2 = gait.interpolate({ inputRange: [0, 1], outputRange: ['22deg', '-22deg'] });
    const armRot = gait.interpolate({ inputRange: [0, 1], outputRange: ['22deg', '-22deg'] });
    const armRot2 = gait.interpolate({ inputRange: [0, 1], outputRange: ['-22deg', '22deg'] });

    return (
        <Animated.View
            style={[
                styles.walkerWrap,
                {
                    transform: [
                        { translateX: tx },
                        { translateY: ty },
                        { rotate: bodyRot },
                    ],
                },
            ]}
        >
            {/* Minimalist "human": head + torso + swinging arms/legs */}
            <View style={[styles.head, { backgroundColor: color }]} />
            <View style={[styles.torso, { backgroundColor: color }]} />

            <Animated.View style={[styles.arm, styles.armL, { backgroundColor: color, transform: [{ rotate: armRot }] }]} />
            <Animated.View style={[styles.arm, styles.armR, { backgroundColor: color, transform: [{ rotate: armRot2 }] }]} />

            <Animated.View style={[styles.leg, styles.legL, { backgroundColor: color, transform: [{ rotate: legRot }] }]} />
            <Animated.View style={[styles.leg, styles.legR, { backgroundColor: color, transform: [{ rotate: legRot2 }] }]} />
        </Animated.View>
    );
}

export function AntChase({ width = 280, height = 86 }: Props) {
    // Two loops that never coincide (different radii), so they "chase" but never meet.
    // Use larger radii so they roam broadly across the available area.
    const pointsRed = useMemo(() => buildLoopPoints(width, height, width * 0.46, height * 0.40), [width, height]);
    const pointsBlack = useMemo(() => buildLoopPoints(width, height, width * 0.38, height * 0.46), [width, height]);

    const tRed = useRef(new Animated.Value(0)).current;
    const tBlack = useRef(new Animated.Value(0)).current;
    const gait = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const a = Animated.loop(
            Animated.timing(tRed, {
                toValue: 1,
                duration: 5200,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        const b = Animated.loop(
            Animated.timing(tBlack, {
                toValue: 1,
                duration: 6100,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        const legs = Animated.loop(
            Animated.sequence([
                Animated.timing(gait, { toValue: 1, duration: 220, easing: Easing.linear, useNativeDriver: true }),
                Animated.timing(gait, { toValue: 0, duration: 220, easing: Easing.linear, useNativeDriver: true }),
            ])
        );
        a.start();
        b.start();
        legs.start();
        return () => {
            a.stop();
            b.stop();
            legs.stop();
        };
    }, [gait, tBlack, tRed]);

    return (
        <View style={[styles.stage, { width, height }]} pointerEvents="none">
            <Walker t={tRed} color="#C41E3A" points={pointsRed} gait={gait} />
            <Walker t={tBlack} color="#111111" points={pointsBlack} gait={gait} />
        </View>
    );
}

const HUMAN_SIZE = 22;
const styles = StyleSheet.create({
    stage: {
        alignSelf: 'center',
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    walkerWrap: {
        position: 'absolute',
        left: -HUMAN_SIZE / 2,
        top: -HUMAN_SIZE / 2,
        width: HUMAN_SIZE,
        height: HUMAN_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    head: {
        position: 'absolute',
        top: 1,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    torso: {
        position: 'absolute',
        top: 7,
        width: 2,
        height: 9,
        borderRadius: 1,
    },
    arm: {
        position: 'absolute',
        top: 9,
        width: 9,
        height: 2,
        borderRadius: 1,
        opacity: 0.95,
    },
    armL: {
        left: 3,
    },
    armR: {
        right: 3,
    },
    leg: {
        position: 'absolute',
        top: 14,
        width: 9,
        height: 2,
        borderRadius: 1,
        opacity: 0.95,
    },
    legL: {
        left: 4,
    },
    legR: {
        right: 4,
    },
});
