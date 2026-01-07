import 'react-native-gesture-handler';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useMemo } from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { navigationRef } from '@/navigation/navigationRef';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';

const queryClient = new QueryClient();

import { useSupabaseDeepLink } from '@/hooks/useSupabaseDeepLink';

import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App() {
  console.log('🔥 APP RENDER CYCLE START');

  // #region agent log
  // RUN_MARKER: used to isolate logs for the current run without clearing .cursor/debug.log
  if (__DEV__) {
    const marker = `run_marker_${Date.now()}`;
    (globalThis as any).__DEBUG_RUN_MARKER__ = marker;
    fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:runMarker',message:'RUN_MARKER',data:{marker},timestamp:Date.now(),sessionId:'debug-session',runId:marker,hypothesisId:'MARK'})}).catch(()=>{});
  }
  // #endregion

  // Global Deep Link Listener (Auth Redirects)
  useSupabaseDeepLink();

  // #region agent log
  // Run architecture debug check on app start (dev mode only)
  if (__DEV__) {
    import('@/utils/architectureDebugger').then(({ runArchitectureDebug }) => {
      // Run after a brief delay to ensure stores are initialized
      setTimeout(() => {
        try {
          const results = runArchitectureDebug();
          console.log('🏗️ Architecture Debug Check:', {
            navigation: results.navigation.allPassed,
            state: results.state.allPassed,
          });
        } catch (error) {
          console.warn('Architecture debug check failed:', error);
        }
      }, 1000);
    }).catch(() => {
      // Silently fail if import fails
    });
  }
  // #endregion

  // Get auth state to key NavigationContainer
  const user = useAuthStore((state: any) => state.user);
  const isAuthReady = useAuthStore((state: any) => state.isAuthReady);
  const hasSession = !!user;

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const navigationTheme = useMemo(() => {
    return {
      ...NavigationDefaultTheme,
      colors: {
        ...NavigationDefaultTheme.colors,
        background: '#FFFFFF',
        text: '#111111',
        card: '#FFFFFF',
        primary: '#FF4FA3',
        border: '#E5E7EB',
      },
    };
  }, []);

  console.log('🔥 APP STATE:', { fontsLoaded, isAuthReady, hasSession, userId: user?.id });

  // Show loading state while fonts are loading
  // Note: We DON'T wait for isAuthReady here because that creates a circular dependency:
  // - isAuthReady is set by useSupabaseAuthBootstrap
  // - useSupabaseAuthBootstrap is in RootNavigator
  // - RootNavigator won't mount if we return null here
  // Solution: Let RootNavigator handle the isAuthReady waiting internally
  if (!fontsLoaded) {
    return null; // Or return a loading screen component
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <NavigationContainer
              key={hasSession ? `auth-${user?.id}` : 'unauth'}
              ref={navigationRef}
              theme={navigationTheme}
            >
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
