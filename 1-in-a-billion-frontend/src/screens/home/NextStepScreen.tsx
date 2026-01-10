import { useEffect, useRef } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { typography, colors } from '@/theme/tokens';
import { useIsFocused } from '@react-navigation/native';

type Props = NativeStackScreenProps<MainStackParamList, 'NextStep'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const NextStepScreen = ({ navigation }: Props) => {
  const videoRef = useRef<Video>(null);
  const isFocused = useIsFocused();

  // Be explicit: expo-av can sometimes fail to autoplay with only `shouldPlay`.
  useEffect(() => {
    if (isFocused) {
      videoRef.current?.playAsync().catch(() => {});
    } else {
      videoRef.current?.pauseAsync().catch(() => {});
    }
  }, [isFocused]);

  const buttons = [
    {
      label: 'MY SOULS LIBRARY',
      onPress: () => navigation.navigate('MyLibrary'),
    },
    {
      label: 'MY KARMIC ZOO',
      onPress: () => navigation.navigate('ComparePeople'),
    },
    {
      label: 'EXPLORE MYSELF',
      onPress: () => navigation.navigate('SystemsOverview'),
    },
    {
      label: 'BACK TO MY SECRET LIFE',
      onPress: () => navigation.navigate('Home'),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Screen ID */}
      <Text style={styles.screenId}>11</Text>

      {/* Headline */}
      <Text style={styles.headline}>Soul Laboratory</Text>

      {/* Buttons overlay - Moved DOWN for balance */}
      <View style={styles.buttonsContainer}>
        {buttons.map((btn) => (
          <TouchableOpacity
            key={btn.label}
            style={styles.button}
            onPress={btn.onPress}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Video at bottom - Fills bottom area on all screen sizes */}
      <Video
        ref={videoRef}
        source={require('../../../assets/videos/hello_i_love_you.mp4')}
        style={styles.bottomVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isLooping
        isMuted
        volume={0}
        onReadyForDisplay={() => {
          // Ensure autoplay resumes once the first frame is ready.
          if (isFocused) videoRef.current?.playAsync().catch(() => {});
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screenId: {
    position: 'absolute',
    top: 55,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
  headline: {
    position: 'absolute',
    top: 120, // Standard headline position
    width: '100%',
    textAlign: 'center',
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    zIndex: 100,
  },
  bottomVideo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.35, // Smaller height, flush to bottom
    zIndex: 1,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: 'flex-start', // Align to top
    paddingTop: 240, // Moved down a bit (was 200)
    paddingBottom: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16, // Reduced from 24 to fit 5 buttons
    zIndex: 2,
  },
  button: {
    width: '100%',
    backgroundColor: colors.surface,
    paddingVertical: 16, // Reduced from 18 to save space
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.text,
  },
  buttonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.5,
  },
});
