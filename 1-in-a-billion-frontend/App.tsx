import 'react-native-gesture-handler';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useMemo, useEffect, useState } from 'react';
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
import { colors } from '@/theme/tokens';
import { getPaymentConfig } from '@/services/payments';

// Lazy-load Stripe to avoid crash if native modules aren't available
let StripeProvider: any = null;
try {
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
} catch (e) {
  console.warn('⚠️ Stripe native modules not available - payments disabled');
}

const queryClient = new QueryClient();

import { useSupabaseDeepLink } from '@/hooks/useSupabaseDeepLink';

import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App() {
  console.log('🔥 APP RENDER CYCLE START');
  // Global Deep Link Listener (Auth Redirects)
  useSupabaseDeepLink();
  // Get auth state to key NavigationContainer
  const user = useAuthStore((state: any) => state.user);
  const isAuthReady = useAuthStore((state: any) => state.isAuthReady);
  const hasSession = !!user;

  // Stripe configuration
  const [stripeKey, setStripeKey] = useState<string | null>(null);
  
  useEffect(() => {
    // Fetch Stripe publishable key from backend
    getPaymentConfig().then(config => {
      if (config?.publishableKey) {
        setStripeKey(config.publishableKey);
        console.log('💳 Stripe configured');
      }
    }).catch(err => {
      console.warn('⚠️ Stripe config failed:', err.message);
    });
  }, []);

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
        // Make navigator surfaces transparent so the global leather texture shows through.
        background: 'transparent',
        text: '#111111',
        card: 'transparent',
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

  // Wrap content with StripeProvider if key is available
  const appContent = (
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
  
  // Wrap with StripeProvider when key is available AND native modules are loaded
  if (stripeKey && StripeProvider) {
    return (
      <StripeProvider
        publishableKey={stripeKey}
        merchantIdentifier="merchant.app.1-in-a-billion"
        urlScheme="oneinabillion"
      >
        {appContent}
      </StripeProvider>
    );
  }
  
  // Render without Stripe if key not yet loaded or native modules unavailable
  return appContent;
}
