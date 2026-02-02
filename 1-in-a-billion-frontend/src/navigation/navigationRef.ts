import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const resetToOnboardingStart = () => {
  console.log('🔄 resetToOnboardingStart called, isReady:', navigationRef.isReady());
  
  const doReset = () => {
    try {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          // Start at Intro screen (Screen 1)
          routes: [{ name: 'Intro' }],
        })
      );
      console.log('🔄 Navigation reset dispatched');
    } catch (error) {
      console.log('🔄 Navigation reset error:', error);
    }
  };
  
  if (navigationRef.isReady()) {
    doReset();
  } else {
    // Wait for navigation to be ready
    setTimeout(() => {
      if (navigationRef.isReady()) {
        doReset();
      } else {
        console.log('🔄 Navigation still not ready after delay');
      }
    }, 500);
  }
};

// Backwards compat (older code used resetToIntro)
export const resetToIntro = resetToOnboardingStart;

export const navigateToScreen = (screenName: string, params?: any) => {
  console.log('🔄 navigateToScreen:', screenName, params);
  if (navigationRef.isReady()) {
    try {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: screenName, params }],
        })
      );
      console.log('🔄 Navigation to', screenName, 'dispatched');
    } catch (error) {
      console.log('🔄 Navigation error:', error);
    }
  }
};




