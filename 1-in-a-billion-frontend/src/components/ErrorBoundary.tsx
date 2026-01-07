import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import * as Updates from 'expo-updates';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleRestart = async () => {
        try {
            await Updates.reloadAsync();
        } catch (e) {
            // Fallback if expo-updates isn't available (e.g. dev client)
            console.log('Reload not supported, user must restart manually');
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={styles.container}>
                    <ScrollView contentContainerStyle={styles.content}>
                        <Text style={styles.title}>Something went wrong</Text>
                        <Text style={styles.subtitle}>
                            The application encountered an unexpected error.
                        </Text>

                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>
                                {this.state.error?.toString()}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={this.handleRestart}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.buttonText}>Restart App</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.page,
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.mutedText,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    errorBox: {
        backgroundColor: '#FFF0F0',
        padding: spacing.md,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: '#FFCDCD',
        marginBottom: spacing.xl,
        width: '100%',
    },
    errorText: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: '#D32F2F',
    },
    button: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: radii.button,
    },
    buttonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
});
