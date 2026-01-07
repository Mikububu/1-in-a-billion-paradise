import { useRef } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { typography, colors } from '@/theme/tokens';

type Props = NativeStackScreenProps<MainStackParamList, 'NextStep'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const NextStepScreen = ({ navigation }: Props) => {
  const videoRef = useRef<Video>(null);

  const buttons = [
    {
      label: 'ADD A PERSON',
      onPress: () => navigation.navigate('PeopleList', { mode: 'select', returnTo: 'SystemSelection' }),
    },
    {
      label: 'COMPARE TWO PEOPLE',
      onPress: () => navigation.navigate('ComparePeople'),
    },
    {
      label: 'EXPLORE MYSELF',
      onPress: () => navigation.navigate('SystemsOverview'),
    },
    {
      label: 'BACK TO CONTROL CENTER',
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
        shouldPlay
        isLooping
        isMuted
        usePoster
        posterSource={require('../../../assets/images/hello_i_love_you_poster.png')}
        posterStyle={{ resizeMode: 'cover' }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontSize: 36,
    color: colors.text,
    fontStyle: 'italic',
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
    paddingTop: 240, // Sweet spot between headline and video
    paddingBottom: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
    zIndex: 2,
  },
  button: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  buttonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: '#000',
    letterSpacing: 0.5,
  },
});
