import 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo } from 'react';
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
import { ErrorBoundary } from '@/components/ErrorBoundary';

const queryClient = new QueryClient();

// Stub ErrorBoundary for now if not exists
// const ErrorBoundary = ({ children }: any) => <>{children}</>;

export default function App() {
    console.log('🔥 APP RENDER CYCLE START');

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
                background: 'transparent',
                text: '#111111',
                card: 'transparent',
                primary: '#FF4FA3',
                border: '#E5E7EB',
            },
        };
    }, []);

    console.log('🔥 APP STATE:', { fontsLoaded, isAuthReady, hasSession, userId: user?.id });

    if (!fontsLoaded) {
        return null;
    }

    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <QueryClientProvider client={queryClient}>
                        <NavigationContainer
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
