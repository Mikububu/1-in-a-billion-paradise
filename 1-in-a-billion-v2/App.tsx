import 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { navigationRef } from '@/navigation/navigationRef';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text } from 'react-native';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/tokens';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { logger } from '@/utils/logger';
import { initGlobalErrorHandler } from '@/utils/globalErrorHandler';
import { initLanguage } from '@/i18n';
import { linking } from '@/navigation/linking';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 5 * 60_000,
            gcTime: 10 * 60_000,
        },
    },
});

export default function App() {
    const [isLangReady, setIsLangReady] = useState(false);

    // Initialize global error handler + language preference on mount
    useEffect(() => {
        initGlobalErrorHandler();
        initLanguage().finally(() => setIsLangReady(true));
    }, []);

    logger.info('APP RENDER CYCLE START');

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

    logger.info('APP STATE:', { fontsLoaded, isAuthReady, hasSession, userId: user?.id, isLangReady });

    if (!fontsLoaded || !isLangReady) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#999', fontSize: 16 }}>Loading...</Text>
            </View>
        );
    }

    return (
        <ErrorBoundary onReset={() => navigationRef.current?.reset({ index: 0, routes: [{ name: 'Root' as any }] })}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <QueryClientProvider client={queryClient}>
                        <NavigationContainer
                            ref={navigationRef}
                            theme={navigationTheme}
                            linking={linking}
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
