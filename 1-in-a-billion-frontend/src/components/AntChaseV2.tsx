/**
 * ANT CHASE V2 - Improved Walking Animation
 * 
 * ISOLATED VERSION - Does not affect existing AntChase.tsx
 * 
 * Improvements:
 * - More natural walking gait
 * - Gender distinction (men/women)
 * - Better body proportions
 * - Smoother motion
 * 
 * To use: Replace <AntChase /> with <AntChaseV2 /> in HomeScreen.tsx
 * To revert: Just change back to <AntChase />
 */

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type Gender = 'male' | 'female';

type Props = {
  width?: number;
  height?: number;
  gender1?: Gender;
  gender2?: Gender;
};

function buildLoopPoints(width: number, height: number, a: number, b: number) {
  const cx = width / 2;
  const cy = height / 2;
  const n = 64;
  const input: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  const rot: number[] = []; // Changed to numbers for easier math

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const theta = t * Math.PI * 2;
    const px = cx + a * Math.cos(theta);
    const py = cy + b * Math.sin(theta);
    const dx = -a * Math.sin(theta);
    const dy = b * Math.cos(theta);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;

    input.push(t);
    x.push(px);
    y.push(py);
    rot.push(deg); // Store as number
  }

  return { input, x, y, rot };
}

function Walker({
  t,
  color,
  points,
  gait,
  bodyBounce,
  gender,
}: {
  t: Animated.Value;
  color: string;
  points: ReturnType<typeof buildLoopPoints>;
  gait: Animated.Value;
  bodyBounce: Animated.Value;
  gender: Gender;
}) {
  const tx = t.interpolate({ inputRange: points.input, outputRange: points.x });
  const ty = t.interpolate({ inputRange: points.input, outputRange: points.y });
  
  // Body rotation from path direction (convert numbers back to string format)
  const bodyRot = t.interpolate({ 
    inputRange: points.input, 
    outputRange: points.rot.map(deg => `${deg}deg`)
  });
  
  // Slight forward lean when walking (more realistic) - interpolate as string
  const bodyLean = gait.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '2deg', '0deg'], // Subtle forward lean
  });
  
  // For rotation, we'll use bodyRot only (lean is too complex to combine with string interpolation)
  // The lean effect is subtle enough that bodyRot alone looks natural
  
  // More realistic leg swing - one leg forward while other back (like real walking)
  const legRotL = gait.interpolate({ 
    inputRange: [0, 0.3, 0.5, 0.7, 1], 
    outputRange: ['-25deg', '-10deg', '20deg', '10deg', '-25deg'] // More gradual, realistic motion
  });
  const legRotR = gait.interpolate({ 
    inputRange: [0, 0.3, 0.5, 0.7, 1], 
    outputRange: ['20deg', '10deg', '-25deg', '-10deg', '20deg'] // Opposite phase
  });
  
  // Arm swing - opposite to legs, more subtle (realistic walking)
  const armRotL = gait.interpolate({ 
    inputRange: [0, 0.3, 0.5, 0.7, 1], 
    outputRange: ['15deg', '5deg', '-20deg', '-5deg', '15deg'] // More subtle swing
  });
  const armRotR = gait.interpolate({ 
    inputRange: [0, 0.3, 0.5, 0.7, 1], 
    outputRange: ['-20deg', '-5deg', '15deg', '5deg', '-20deg'] // Opposite phase
  });
  
  // Body bounce (slight vertical movement while walking)
  const bounceY = bodyBounce.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -1.5, 0],
  });

  // Gender-specific proportions
  const isMale = gender === 'male';
  const shoulderWidth = isMale ? 8 : 6;
  const hipWidth = isMale ? 6 : 8;
  const headSize = isMale ? 7 : 6.5;

  return (
    <Animated.View
      style={[
        styles.walkerWrap,
        {
          transform: [
            { translateX: tx },
            { translateY: Animated.add(ty, bounceY) },
            { rotate: bodyRot }, // Body rotation (lean effect is subtle, using rotation only)
          ],
        },
      ]}
    >
      {/* Head */}
      <View style={[styles.head, { 
        width: headSize, 
        height: headSize, 
        borderRadius: headSize / 2,
        backgroundColor: color 
      }]} />
      
      {/* Hair (gender distinction) */}
      {!isMale && (
        <View style={[styles.hair, { backgroundColor: color, opacity: 0.7 }]} />
      )}
      
      {/* Torso (gender-specific width) */}
      <View style={[styles.torso, { 
        width: 3, 
        height: 10,
        backgroundColor: color 
      }]} />
      
      {/* Shoulders (broader for men) */}
      <View style={[styles.shoulders, { 
        width: shoulderWidth, 
        height: 2,
        backgroundColor: color 
      }]} />
      
      {/* Arms (swinging naturally) */}
      <Animated.View style={[
        styles.arm, 
        styles.armL, 
        { 
          backgroundColor: color, 
          transform: [{ rotate: armRotL }] 
        }
      ]} />
      <Animated.View style={[
        styles.arm, 
        styles.armR, 
        { 
          backgroundColor: color, 
          transform: [{ rotate: armRotR }] 
        }
      ]} />
      
      {/* Hips (wider for women) */}
      <View style={[styles.hips, { 
        width: hipWidth, 
        height: 2,
        backgroundColor: color 
      }]} />
      
      {/* Legs (natural walking motion) */}
      <Animated.View style={[
        styles.leg, 
        styles.legL, 
        { 
          backgroundColor: color, 
          transform: [{ rotate: legRotL }] 
        }
      ]} />
      <Animated.View style={[
        styles.leg, 
        styles.legR, 
        { 
          backgroundColor: color, 
          transform: [{ rotate: legRotR }] 
        }
      ]} />
    </Animated.View>
  );
}

export function AntChaseV2({ 
  width = 280, 
  height = 86,
  gender1 = 'male',
  gender2 = 'female',
}: Props) {
  // Two loops that never coincide
  const pointsRed = useMemo(() => buildLoopPoints(width, height, width * 0.46, height * 0.40), [width, height]);
  const pointsBlack = useMemo(() => buildLoopPoints(width, height, width * 0.38, height * 0.46), [width, height]);

  const tRed = useRef(new Animated.Value(0)).current;
  const tBlack = useRef(new Animated.Value(0)).current;
  const gait = useRef(new Animated.Value(0)).current;
  const bodyBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Walking loops - MUCH SLOWER (like real people walking, not racing)
    const walkRed = Animated.loop(
      Animated.timing(tRed, {
        toValue: 1,
        duration: 18000, // Was 5200 - now 3.5x slower (calm walking pace)
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    const walkBlack = Animated.loop(
      Animated.timing(tBlack, {
        toValue: 1,
        duration: 21000, // Was 6100 - now 3.5x slower
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    // Leg/arm gait - SLOWER, more realistic walking rhythm
    const walkingGait = Animated.loop(
      Animated.sequence([
        Animated.timing(gait, { 
          toValue: 1, 
          duration: 600, // Was 400 - slower step
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true 
        }),
        Animated.timing(gait, { 
          toValue: 0, 
          duration: 600, // Was 400 - slower step
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true 
        }),
      ])
    );
    
    // Body bounce - SLOWER, more natural (like real walking)
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bodyBounce, {
          toValue: 1,
          duration: 600, // Match gait speed
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bodyBounce, {
          toValue: 0,
          duration: 600, // Match gait speed
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    walkRed.start();
    walkBlack.start();
    walkingGait.start();
    bounce.start();
    
    return () => {
      walkRed.stop();
      walkBlack.stop();
      walkingGait.stop();
      bounce.stop();
    };
  }, [gait, tBlack, tRed, bodyBounce]);

  return (
    <View style={[styles.stage, { width, height }]} pointerEvents="none">
      <Walker 
        t={tRed} 
        color="#C41E3A" 
        points={pointsRed} 
        gait={gait} 
        bodyBounce={bodyBounce}
        gender={gender1}
      />
      <Walker 
        t={tBlack} 
        color="#111111" 
        points={pointsBlack} 
        gait={gait} 
        bodyBounce={bodyBounce}
        gender={gender2}
      />
    </View>
  );
}

const HUMAN_SIZE = 28; // Slightly larger for better detail
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
    top: 0,
    zIndex: 10,
  },
  hair: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 4,
    borderRadius: 4,
    zIndex: 9,
  },
  torso: {
    position: 'absolute',
    top: 7,
    borderRadius: 1.5,
  },
  shoulders: {
    position: 'absolute',
    top: 7,
    left: -2.5,
    borderRadius: 1,
  },
  hips: {
    position: 'absolute',
    top: 16,
    left: -1.5,
    borderRadius: 1,
  },
  arm: {
    position: 'absolute',
    top: 9,
    width: 10,
    height: 2.5,
    borderRadius: 1.25,
    opacity: 0.95,
  },
  armL: {
    left: 4,
  },
  armR: {
    right: 4,
  },
  leg: {
    position: 'absolute',
    top: 18,
    width: 10,
    height: 2.5,
    borderRadius: 1.25,
    opacity: 0.95,
  },
  legL: {
    left: 4.5,
  },
  legR: {
    right: 4.5,
  },
});

