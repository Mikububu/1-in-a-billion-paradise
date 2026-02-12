/**
 * SETTINGS SCREEN
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';
import { BackButton } from '@/components/BackButton';
import { fetchPeopleFromSupabase } from '@/services/peopleCloud';
import { isSupabaseConfigured } from '@/services/supabase';
import {
    getMatchNotificationPreferences,
    updateMatchNotificationPreferences,
} from '@/services/matchNotifications';

type Props = NativeStackScreenProps<MainStackParamList, 'Settings'>;

type SettingsItem = {
    id: string;
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    danger?: boolean;
};

type SettingsSection = {
    title: string;
    items: SettingsItem[];
};

export const SettingsScreen = ({ navigation }: Props) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [isMatchAlertsSaving, setIsMatchAlertsSaving] = useState(false);
    const [matchAlertsEnabled, setMatchAlertsEnabled] = useState(false);
    const [matchAlertsLoaded, setMatchAlertsLoaded] = useState(false);
    const resetOnboarding = useOnboardingStore((state) => state.reset);
    const resetProfile = useProfileStore((state) => state.reset);
    const signOut = useAuthStore((s: any) => s.signOut);
    const resetSubscription = useSubscriptionStore((s: any) => s.reset);
    const authUser = useAuthStore((s: any) => s.user);
    const upsertPersonById = useProfileStore((s) => s.upsertPersonById);

    const people = useProfileStore((state) => state.people);
    const user = people.find(p => p.isUser);
    const isVerified = user?.isVerified || false;

    useEffect(() => {
        let isMounted = true;

        const loadPreferences = async () => {
            if (!authUser?.id) {
                if (isMounted) {
                    setMatchAlertsEnabled(false);
                    setMatchAlertsLoaded(true);
                }
                return;
            }

            const preference = await getMatchNotificationPreferences(authUser.id);
            if (!isMounted) return;

            setMatchAlertsEnabled(preference.matchAlertsEnabled);
            setMatchAlertsLoaded(true);
        };

        loadPreferences();
        return () => {
            isMounted = false;
        };
    }, [authUser?.id]);

    const handleForceSync = async () => {
        if (!authUser?.id || !isSupabaseConfigured) {
            Alert.alert('Cannot Sync', 'You must be signed in to sync from cloud.');
            return;
        }

        Alert.alert(
            'Force Sync from Cloud',
            'This will download your data from the cloud and overwrite any local changes. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sync Now',
                    onPress: async () => {
                        setIsSyncing(true);
                        try {
                            const result = await fetchPeopleFromSupabase(authUser.id);

                            if (result.success && result.people.length > 0) {
                                for (const person of result.people) {
                                    upsertPersonById(person);
                                }
                                Alert.alert('Sync Complete', `Downloaded ${result.people.length} profiles from cloud.`);
                            } else if (result.success && result.people.length === 0) {
                                Alert.alert('No Data Found', 'No profiles found in cloud.');
                            } else {
                                Alert.alert('Sync Failed', (result as any).error || 'Could not fetch data from cloud.');
                            }
                        } catch (error: any) {
                            Alert.alert('Sync Error', error.message || 'An error occurred.');
                        } finally {
                            setIsSyncing(false);
                        }
                    },
                },
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out? Your data will be saved locally.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                    }
                },
            ]
        );
    };

    const handleStartOver = () => {
        Alert.alert(
            'Start Over',
            'This will log you out and clear all local data. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Start Over',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                        resetProfile();
                        resetSubscription();
                        resetOnboarding();
                    },
                },
            ]
        );
    };

    const SUPPORT_EMAIL = 'contact@1-in-a-billion.app';

    const handleContactSupport = () => {
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=App Support Request`);
    };

    const handleMatchAlerts = () => {
        if (!authUser?.id) {
            Alert.alert('Sign in required', 'Please sign in to manage notification preferences.');
            return;
        }

        if (!matchAlertsLoaded || isMatchAlertsSaving) return;

        const nextEnabled = !matchAlertsEnabled;
        const title = nextEnabled ? 'Enable Match Alerts' : 'Disable Match Alerts';
        const message = nextEnabled
            ? 'Allow push + email alerts when your first match appears?'
            : 'Stop first-match alerts by push + email?';

        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: nextEnabled ? 'Enable' : 'Disable',
                style: nextEnabled ? 'default' : 'destructive',
                onPress: async () => {
                    setIsMatchAlertsSaving(true);
                    const updated = await updateMatchNotificationPreferences({
                        userId: authUser.id,
                        enabled: nextEnabled,
                        source: 'settings',
                    });
                    if (updated) {
                        setMatchAlertsEnabled(updated.matchAlertsEnabled);
                    } else {
                        Alert.alert('Update failed', 'Could not save notification preference.');
                    }
                    setIsMatchAlertsSaving(false);
                },
            },
        ]);
    };

    const sections: SettingsSection[] = [
        {
            title: 'Account',
            items: [
                {
                    id: 'profile',
                    icon: '◉',
                    title: 'Your Profile',
                    subtitle: isVerified ? 'Verified ✓' : 'Not verified',
                    onPress: () => navigation.navigate('YourChart'),
                },
                {
                    id: 'library',
                    icon: '☰',
                    title: 'My Library',
                    subtitle: 'Readings, audio & saved content',
                    onPress: () => navigation.navigate('MyLibrary'),
                },
                {
                    id: 'sync',
                    icon: '↓',
                    title: isSyncing ? 'Syncing...' : 'Sync from Cloud',
                    subtitle: 'Download latest data from server',
                    onPress: handleForceSync,
                },
                {
                    id: 'match_alerts',
                    icon: '○',
                    title: isMatchAlertsSaving ? 'Saving...' : 'Match Alerts',
                    subtitle: matchAlertsLoaded
                        ? matchAlertsEnabled
                            ? 'On (first match)'
                            : 'Off'
                        : 'Loading...',
                    onPress: handleMatchAlerts,
                },
            ],
        },
        {
            title: 'Privacy & Data',
            items: [
                {
                    id: 'ai_disclosure',
                    icon: '◎',
                    title: 'AI & Data Usage',
                    onPress: () => navigation.navigate('DataPrivacy'),
                },
                {
                    id: 'privacy',
                    icon: '▣',
                    title: 'Privacy Policy',
                    onPress: () => navigation.navigate('PrivacyPolicy'),
                },
                {
                    id: 'terms',
                    icon: '≡',
                    title: 'Terms of Service',
                    onPress: () => navigation.navigate('TermsOfService'),
                },
            ],
        },
        {
            title: 'Support',
            items: [
                {
                    id: 'help',
                    icon: '?',
                    title: 'Help & FAQ',
                    onPress: () => navigation.navigate('ContactSupport'),
                },
                {
                    id: 'about',
                    icon: 'i',
                    title: 'About',
                    onPress: () => navigation.navigate('About'),
                },
            ],
        },
        {
            title: 'Account Actions',
            items: [
                {
                    id: 'logout',
                    icon: '←',
                    title: 'Log Out',
                    onPress: handleLogout,
                },
                {
                    id: 'start_over',
                    icon: '↺',
                    title: 'Start Over',
                    onPress: handleStartOver,
                    danger: true,
                },
                {
                    id: 'delete',
                    icon: '×',
                    title: 'Delete Account',
                    onPress: () => navigation.navigate('AccountDeletion'),
                    danger: true,
                },
            ],
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {sections.map((section) => (
                    <View key={section.title} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <View style={styles.sectionContent}>
                            {section.items.map((item, index) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        styles.settingsItem,
                                        index === section.items.length - 1 && styles.settingsItemLast,
                                    ]}
                                    onPress={item.onPress}
                                    activeOpacity={0.7}
                                >
                                    <AnimatedSystemIcon icon={item.icon} size={20} />
                                    <View style={styles.itemContent}>
                                        <Text style={[styles.itemTitle, item.danger && styles.itemTitleDanger]}>
                                            {item.title}
                                        </Text>
                                        {item.subtitle && (
                                            <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                                        )}
                                    </View>
                                    <Text style={styles.itemArrow}>→</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>1 In A Billion</Text>
                    <Text style={styles.footerVersion}>Version 2.0.0</Text>
                    <Text style={styles.footerCopy}>© 2024 One In A Billion Ltd.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.page,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    headerTitle: {
        fontFamily: typography.headline,
        fontSize: 24,
        color: colors.text,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingVertical: spacing.lg,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 12,
        color: colors.mutedText,
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: spacing.page,
        marginBottom: spacing.sm,
    },
    sectionContent: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.page,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    settingsItemLast: {
        borderBottomWidth: 0,
    },
    itemContent: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    itemTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    itemTitleDanger: {
        color: colors.primary,
    },
    itemSubtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
        marginTop: 2,
    },
    itemArrow: {
        fontFamily: typography.sansMedium,
        fontSize: 18,
        color: colors.mutedText,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.page,
    },
    footerText: {
        fontFamily: typography.headline,
        fontSize: 18,
        color: colors.text,
    },
    footerVersion: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
        marginTop: spacing.xs,
    },
    footerCopy: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        marginTop: spacing.xs,
    },
});
