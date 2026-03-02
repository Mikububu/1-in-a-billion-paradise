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
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';
import { BackButton } from '@/components/BackButton';
import { fetchPeopleFromSupabase } from '@/services/peopleCloud';
import { isSupabaseConfigured } from '@/services/supabase';
import {
    getMatchNotificationPreferences,
    updateMatchNotificationPreferences,
} from '@/services/matchNotifications';
import { t } from '@/i18n';

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
            Alert.alert(t('settings.sync.error.cannotSync'), t('settings.sync.error.notSignedIn'));
            return;
        }

        Alert.alert(
            t('settings.sync.title'),
            t('settings.sync.description'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('settings.sync.button'),
                    onPress: async () => {
                        setIsSyncing(true);
                        try {
                            const result = await fetchPeopleFromSupabase(authUser.id);

                            if (result.success && result.people.length > 0) {
                                for (const person of result.people) {
                                    upsertPersonById(person);
                                }
                                Alert.alert(t('settings.sync.success.title'), t('settings.sync.success.message', { count: result.people.length }));
                            } else if (result.success && result.people.length === 0) {
                                Alert.alert(t('settings.sync.empty.title'), t('settings.sync.empty.message'));
                            } else {
                                Alert.alert(t('settings.sync.failed.title'), (result as any).error || 'Could not fetch data from cloud.');
                            }
                        } catch (error: any) {
                            Alert.alert(t('settings.sync.error.title'), error.message || 'An error occurred.');
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
            t('settings.logout.title'),
            t('settings.logout.message'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('settings.accountActions.logout'),
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
            t('settings.startOver.title'),
            t('settings.startOver.message'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('settings.accountActions.startOver'),
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                        resetProfile();
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
            Alert.alert(t('settings.matchAlerts.error.signInRequired'), t('settings.matchAlerts.error.signInMessage'));
            return;
        }

        if (!matchAlertsLoaded || isMatchAlertsSaving) return;

        const nextEnabled = !matchAlertsEnabled;
        const title = nextEnabled ? t('settings.matchAlerts.enable.title') : t('settings.matchAlerts.disable.title');
        const message = nextEnabled
            ? t('settings.matchAlerts.enable.message')
            : t('settings.matchAlerts.disable.message');

        Alert.alert(title, message, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: nextEnabled ? t('settings.matchAlerts.enable.button') : t('settings.matchAlerts.disable.button'),
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
                        Alert.alert(t('settings.matchAlerts.error.updateFailed'), t('settings.matchAlerts.error.saveFailed'));
                    }
                    setIsMatchAlertsSaving(false);
                },
            },
        ]);
    };

    const sections: SettingsSection[] = [
        {
            title: t('settings.section.account'),
            items: [
                {
                    id: 'profile',
                    icon: '◉',
                    title: t('settings.account.profile'),
                    subtitle: isVerified ? t('settings.account.profile.verified') : t('settings.account.profile.notVerified'),
                    onPress: () => navigation.navigate('YourChart'),
                },
                {
                    id: 'library',
                    icon: '☰',
                    title: t('settings.account.library'),
                    subtitle: t('settings.account.library.subtitle'),
                    onPress: () => navigation.navigate('MyLibrary'),
                },
                {
                    id: 'sync',
                    icon: '↓',
                    title: isSyncing ? t('settings.account.sync.syncing') : t('settings.account.sync'),
                    subtitle: t('settings.account.sync.subtitle'),
                    onPress: handleForceSync,
                },
                {
                    id: 'match_alerts',
                    icon: '○',
                    title: isMatchAlertsSaving ? t('common.loading') : t('settings.account.matchAlerts'),
                    subtitle: matchAlertsLoaded
                        ? matchAlertsEnabled
                            ? t('settings.account.matchAlerts.on')
                            : t('settings.account.matchAlerts.off')
                        : t('settings.account.matchAlerts.loading'),
                    onPress: handleMatchAlerts,
                },
            ],
        },
        {
            title: t('settings.section.privacyData'),
            items: [
                {
                    id: 'ai_disclosure',
                    icon: '◎',
                    title: t('settings.privacyData.aiUsage'),
                    onPress: () => navigation.navigate('DataPrivacy'),
                },
                {
                    id: 'privacy',
                    icon: '▣',
                    title: t('settings.privacyData.privacy'),
                    onPress: () => navigation.navigate('PrivacyPolicy'),
                },
                {
                    id: 'terms',
                    icon: '≡',
                    title: t('settings.privacyData.terms'),
                    onPress: () => navigation.navigate('TermsOfService'),
                },
            ],
        },
        {
            title: t('settings.section.support'),
            items: [
                {
                    id: 'help',
                    icon: '?',
                    title: t('settings.support.helpFaq'),
                    onPress: () => navigation.navigate('ContactSupport'),
                },
                {
                    id: 'about',
                    icon: 'i',
                    title: t('settings.support.about'),
                    onPress: () => navigation.navigate('About'),
                },
            ],
        },
        {
            title: t('settings.section.accountActions'),
            items: [
                {
                    id: 'logout',
                    icon: '←',
                    title: t('settings.accountActions.logout'),
                    onPress: handleLogout,
                },
                {
                    id: 'start_over',
                    icon: '↺',
                    title: t('settings.accountActions.startOver'),
                    onPress: handleStartOver,
                    danger: true,
                },
                {
                    id: 'delete',
                    icon: '×',
                    title: t('settings.accountActions.deleteAccount'),
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
                <Text style={styles.headerTitle}>{t('settings.title')}</Text>
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
                    <Text style={styles.footerText}>{t('app.name')}</Text>
                    <Text style={styles.footerVersion}>{t('app.version')}</Text>
                    <Text style={styles.footerCopy}>{t('app.copyright')}</Text>
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
