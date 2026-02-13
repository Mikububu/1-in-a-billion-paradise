import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CityOption } from '@/types/forms';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { useSupabaseAuthBootstrap } from '@/hooks/useSupabaseAuthBootstrap';
import { useSupabaseLibraryAutoSync } from '@/hooks/useSupabaseLibraryAutoSync';
import { useRealtimeSubscription } from '@/hooks/useRealtimeArtifactSync';
import { useSecureOnboardingSync } from '@/hooks/useSecureOnboardingSync';
import { enforceJobBufferCap } from '@/services/jobBuffer';
import { verifyEntitlementWithBackend } from '@/services/payments';
import { env } from '@/config/env';
import { TexturedBackground } from '@/components/TexturedBackground';
import { AudioProvider } from '@/contexts/AudioContext';
import { SignInScreen } from '@/screens/auth/SignInScreen';
// Onboarding screens
import { IntroScreen } from '@/screens/onboarding/IntroScreen';
import { RelationshipScreen } from '@/screens/onboarding/RelationshipScreen';
import { BirthInfoScreen } from '@/screens/onboarding/BirthInfoScreen';
import { LanguagesScreen } from '@/screens/onboarding/LanguagesScreen';
import { AccountScreen } from '@/screens/onboarding/AccountScreen';
import { CoreIdentitiesIntroScreen } from '@/screens/onboarding/CoreIdentitiesIntroScreen';
import { CoreIdentitiesScreen } from '@/screens/onboarding/CoreIdentitiesScreen';
import { HookSequenceScreen } from '@/screens/onboarding/HookSequenceScreen';
import { PostHookOfferScreen } from '@/screens/onboarding/PostHookOfferScreen';
import { AddThirdPersonPromptScreen } from '@/screens/onboarding/AddThirdPersonPromptScreen';


// Main screens
import { HomeScreen } from '@/screens/home/HomeScreen';
import { NextStepScreen } from '@/screens/home/NextStepScreen';
import { MyLibraryScreen } from '@/screens/home/MyLibraryScreen';
import { ComparePeopleScreen } from '@/screens/home/ComparePeopleScreen';
import { SystemsOverviewScreen } from '@/screens/home/SystemsOverviewScreen';
import { YourChartScreen } from '@/screens/home/YourChartScreen';
import { PeopleListScreen } from '@/screens/home/PeopleListScreen';
import { PersonProfileScreen } from '@/screens/home/PersonProfileScreen';
import { PersonReadingsScreen } from '@/screens/home/PersonReadingsScreen';
import { PersonPhotoUploadScreen } from '@/screens/home/PersonPhotoUploadScreen';
import { EditBirthDataScreen } from '@/screens/home/EditBirthDataScreen';
import { SystemSelectionScreen } from '@/screens/home/SystemSelectionScreen';
import { PersonalContextScreen } from '@/screens/home/PersonalContextScreen';
import { RelationshipContextScreen } from '@/screens/home/RelationshipContextScreen';
import { VoiceSelectionScreen } from '@/screens/home/VoiceSelectionScreen';
import { TreeOfLifeVideoScreen } from '@/screens/home/TreeOfLifeVideoScreen';
import { GeneratingReadingScreen } from '@/screens/home/GeneratingReadingScreen';
import { JobDetailScreen } from '@/screens/home/JobDetailScreen';
import { ReadingContentScreen } from '@/screens/home/ReadingContentScreen';
import { PartnerInfoScreen } from '@/screens/home/PartnerInfoScreen';
import { PartnerCoreIdentitiesScreen } from '@/screens/home/PartnerCoreIdentitiesScreen';
import { PartnerReadingsScreen } from '@/screens/home/PartnerReadingsScreen';
import { SynastryPreviewScreen } from '@/screens/home/SynastryPreviewScreen';
import { SynastryOptionsScreen } from '@/screens/home/SynastryOptionsScreen';
import { SystemExplainerScreen } from '@/screens/learn/SystemExplainerScreen';
import { GalleryScreen } from '@/screens/social/GalleryScreen';
import { ChatListScreen } from '@/screens/social/ChatListScreen';
import { ChatScreen } from '@/screens/social/ChatScreen';
import {
    SettingsScreen,
    PrivacyPolicyScreen,
    TermsOfServiceScreen,
    DataPrivacyScreen,
    AboutScreen,
    ContactSupportScreen,
    AccountDeletionScreen
} from '@/screens/settings';

export type OnboardingStackParamList = {
    Intro: undefined;
    SignIn: undefined;
    Relationship: undefined;
    BirthInfo: undefined;
    Languages: undefined;
    Account: { fromPayment?: boolean; revenueCatAppUserId?: string } | undefined;
    CoreIdentitiesIntro: undefined;
    CoreIdentities: undefined;
    HookSequence: {
        initialReading?: 'sun' | 'moon' | 'rising';
        customReadings?: any[];
        personName?: string;
    } | undefined;
    PostHookOffer: undefined;
    AddThirdPersonPrompt: undefined;
    PartnerInfo: { mode?: string; returnTo?: string } | undefined;
    PartnerCoreIdentities: any;
    PartnerReadings: any;
    SynastryPreview: any;
};

export type MainStackParamList = {
    Home: undefined;
    NextStep: undefined;
    Gallery: undefined;
    ChatList: undefined;
    Chat: {
        conversationId: string;
        otherName: string;
        otherPortraitUrl: string | null;
    };
    Settings: undefined;
    PrivacyPolicy: undefined;
    TermsOfService: undefined;
    DataPrivacy: undefined;
    About: undefined;
    ContactSupport: undefined;
    AccountDeletion: undefined;
    MyLibrary: undefined;
    ComparePeople: undefined;
    SystemsOverview: {
        personId?: string;
        targetPersonName?: string;
        readingType?: 'individual' | 'overlay';
        forPartner?: boolean;
        partnerName?: string;
        partnerBirthDate?: string;
        partnerBirthTime?: string | null;
        partnerBirthCity?: CityOption | null;
    } | undefined;
    YourChart: undefined;
    PeopleList: undefined;
    PersonProfile: { personId: string };
    PersonReadings: {
        personName: string;
        personId?: string;
        personType: 'individual' | 'person1' | 'person2' | 'overlay';
        jobId?: string;
    };
    PersonPhotoUpload: {
        personId: string;
    };
    EditBirthData: { personId?: string } | undefined;
    SystemExplainer: {
        system: 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah' | 'all';
        forPurchase?: boolean;
        readingType?: 'individual' | 'overlay';
        forPartner?: boolean;
        partnerName?: string;
        partnerBirthDate?: string;
        partnerBirthTime?: string | null;
        partnerBirthCity?: CityOption | null;
        userName?: string;
        person1Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        person2Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        personId?: string;
        targetPersonName?: string;
    };
    PersonalContext: {
        personName?: string;
        readingType?: 'individual' | 'self' | 'other';
        forPartner?: boolean;
        userName?: string;
        personBirthDate?: string;
        personBirthTime?: string | null;
        personBirthCity?: CityOption | null;
        partnerName?: string;
        partnerBirthDate?: string;
        partnerBirthTime?: string | null;
        partnerBirthCity?: CityOption | null;
        person1Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        person2Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        personId?: string;
        partnerId?: string;
        targetPersonName?: string;
        productType?: string;
        systems?: string[];
    } | undefined;
    RelationshipContext: {
        readingType?: 'overlay';
        forPartner?: boolean;
        userName?: string;
        partnerName?: string;
        partnerBirthDate?: string;
        partnerBirthTime?: string | null;
        partnerBirthCity?: CityOption | null;
        person1Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        person2Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        personId?: string;
        partnerId?: string;
        productType?: string;
        systems?: string[];
    } | undefined;
    SystemSelection: {
        readingType?: 'individual' | 'overlay';
        forPartner?: boolean;
        userName?: string;
        partnerName?: string;
        partnerBirthDate?: string;
        partnerBirthTime?: string | null;
        partnerBirthCity?: CityOption | null;
        person1Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        person2Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        personId?: string;
        targetPersonName?: string;
        relationshipContext?: string;
        personalContext?: string;
        preselectedSystem?: 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';
    };
    VoiceSelection: {
        productType: string;
        systems: string[];
        readingType?: 'individual' | 'overlay';
        forPartner?: boolean;
        userName?: string;
        personName?: string;
        partnerName?: string;
        partnerBirthDate?: string;
        partnerBirthTime?: string | null;
        partnerBirthCity?: CityOption | null;
        person1Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        person2Override?: {
            id?: string;
            name: string;
            birthDate: string;
            birthTime: string;
            timezone: string;
            latitude: number;
            longitude: number;
            placements?: any;
        };
        personId?: string;
        partnerId?: string;
        targetPersonName?: string;
        personalContext?: string;
        relationshipContext?: string;
        preselectedVoice?: string;
    };
    TreeOfLifeVideo: {
        jobId: string;
        productType: string;
        productName: string;
        personName?: string;
        partnerName?: string;
        readingType?: 'individual' | 'overlay';
        systems?: string[];
        forPartner?: boolean;
        personId?: string;
        partnerId?: string;
    };
    GeneratingReading: {
        jobId: string;
        productType: string;
        productName: string;
        personName?: string;
        partnerName?: string;
        systems?: string[];
        readingType?: 'individual' | 'overlay';
        forPartner?: boolean;
        personId?: string;
        partnerId?: string;
    };
    JobDetail: {
        jobId: string;
    };
    ReadingContent: {
        jobId: string;
    };
    PartnerInfo: { mode?: 'add_person_only' | 'onboarding_hook'; returnTo?: 'ComparePeople' } | undefined;
    PartnerCoreIdentities: any;
    PartnerReadings: any;
    SynastryPreview: any;
    SynastryOptions: {
        partnerName: string;
        partnerBirthDate?: string;
        partnerBirthTime?: string | null;
        partnerBirthCity?: CityOption | null;
    } | undefined;
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

// Wrapper for SignInScreen in onboarding flow
const SignInScreenWrapper = ({ route }: any) => (
    <SignInScreen />
);

const OnboardingNavigator = ({ initialRouteName = "Intro" }: { initialRouteName?: keyof OnboardingStackParamList }) => {
    return (
        <OnboardingStack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
            }}
            initialRouteName={initialRouteName}
        >
            <OnboardingStack.Screen name="Intro" component={IntroScreen} />
            <OnboardingStack.Screen name="SignIn" component={SignInScreenWrapper} />
            <OnboardingStack.Screen name="Relationship" component={RelationshipScreen} />
            <OnboardingStack.Screen name="BirthInfo" component={BirthInfoScreen} />
            <OnboardingStack.Screen name="Languages" component={LanguagesScreen} />
            <OnboardingStack.Screen name="Account" component={AccountScreen} />
            <OnboardingStack.Screen name="CoreIdentitiesIntro" component={CoreIdentitiesIntroScreen} />
            <OnboardingStack.Screen name="CoreIdentities" component={CoreIdentitiesScreen} />
            <OnboardingStack.Screen name="HookSequence" component={HookSequenceScreen} />
            <OnboardingStack.Screen name="AddThirdPersonPrompt" component={AddThirdPersonPromptScreen} />
            <OnboardingStack.Screen name="PartnerInfo" component={PartnerInfoScreen as any} />
            <OnboardingStack.Screen name="PartnerCoreIdentities" component={PartnerCoreIdentitiesScreen as any} />
            <OnboardingStack.Screen name="PartnerReadings" component={PartnerReadingsScreen as any} />
            <OnboardingStack.Screen name="SynastryPreview" component={SynastryPreviewScreen as any} />
            <OnboardingStack.Screen name="PostHookOffer" component={PostHookOfferScreen} />
        </OnboardingStack.Navigator>
    );
};

const MainNavigator = () => {
    // Hydration/sync is handled by root hooks (auth bootstrap + cloud sync).

    return (
        <MainStack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: 'transparent' },
            }}
            initialRouteName={'Home'}
        >
            <MainStack.Screen
                name="Home"
                component={HomeScreen}
            />
            <MainStack.Screen name="NextStep" component={NextStepScreen} />
            <MainStack.Screen name="MyLibrary" component={MyLibraryScreen} />
            <MainStack.Screen name="ComparePeople" component={ComparePeopleScreen} />
            <MainStack.Screen name="SystemsOverview" component={SystemsOverviewScreen} />
            <MainStack.Screen name="YourChart" component={YourChartScreen} />
            <MainStack.Screen name="PeopleList" component={PeopleListScreen} />
            <MainStack.Screen name="PersonProfile" component={PersonProfileScreen} />
            <MainStack.Screen name="PersonReadings" component={PersonReadingsScreen} />
            <MainStack.Screen name="PersonPhotoUpload" component={PersonPhotoUploadScreen} />
            <MainStack.Screen name="EditBirthData" component={EditBirthDataScreen} />
            <MainStack.Screen name="SystemExplainer" component={SystemExplainerScreen} />
            <MainStack.Screen name="PersonalContext" component={PersonalContextScreen} />
            <MainStack.Screen name="RelationshipContext" component={RelationshipContextScreen} />
            <MainStack.Screen name="SystemSelection" component={SystemSelectionScreen} />
            <MainStack.Screen name="VoiceSelection" component={VoiceSelectionScreen} />
            <MainStack.Screen name="TreeOfLifeVideo" component={TreeOfLifeVideoScreen} />
            <MainStack.Screen name="GeneratingReading" component={GeneratingReadingScreen} />
            <MainStack.Screen name="JobDetail" component={JobDetailScreen} />
            <MainStack.Screen name="ReadingContent" component={ReadingContentScreen} />
            <MainStack.Screen name="Gallery" component={GalleryScreen} />
            <MainStack.Screen name="ChatList" component={ChatListScreen} />
            <MainStack.Screen name="Chat" component={ChatScreen} />
            <MainStack.Screen name="Settings" component={SettingsScreen} />
            <MainStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <MainStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <MainStack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
            <MainStack.Screen name="About" component={AboutScreen} />
            <MainStack.Screen name="ContactSupport" component={ContactSupportScreen} />
            <MainStack.Screen name="AccountDeletion" component={AccountDeletionScreen} />
            <MainStack.Screen name="PartnerInfo" component={PartnerInfoScreen as any} />
            <MainStack.Screen name="PartnerCoreIdentities" component={PartnerCoreIdentitiesScreen as any} />
            <MainStack.Screen name="PartnerReadings" component={PartnerReadingsScreen as any} />
            <MainStack.Screen name="SynastryPreview" component={SynastryPreviewScreen as any} />
            <MainStack.Screen name="SynastryOptions" component={SynastryOptionsScreen as any} />
        </MainStack.Navigator>
    );
};

export const RootNavigator = () => {
    const user = useAuthStore((state: any) => state.user);
    const isLoading = useAuthStore((state: any) => state.isLoading);
    const isAuthReady = useAuthStore((state: any) => state.isAuthReady);
    const setEntitlementState = useAuthStore((state: any) => state.setEntitlementState);

    // 1. Hydrate authStore from persisted Supabase session
    useSupabaseAuthBootstrap();

    // 2. Keep local library synced
    useSupabaseLibraryAutoSync();

    // 3. Realtime artifact sync
    useRealtimeSubscription();

    // 4. Secure Onboarding Sync
    useSecureOnboardingSync();

    // 5. Keep local job receipt buffer capped.
    useEffect(() => {
        enforceJobBufferCap().catch((error) => {
            console.warn('⚠️ Could not enforce job buffer cap', error);
        });
    }, []);

    const hasSession = !!user;
    // Onboarding state - showDashboard controls transition to MainNavigator
    const showDashboard = useOnboardingStore((s) => s.showDashboard);
    const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);
    const isHydrated = useOnboardingStore((s) => s._hasHydrated);

    const [hydrationTimeout, setHydrationTimeout] = useState(false);
    const [entitlementStatus, setEntitlementStatus] = useState<'idle' | 'checking' | 'active' | 'inactive' | 'error'>('idle');

    console.log('🧭 RootNavigator State:', {
        isLoading,
        hasSession,
        hasUser: !!user,
        isHydrated,
        showDashboard,
        hasCompletedOnboarding,
        entitlementStatus,
    });

    // Block rendering until Bootstrap determines if we have a valid session AND persist has hydrated
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isHydrated) {
                console.warn('⚠️ RootNavigator: Hydration timeout - proceeding anyway');
                setHydrationTimeout(true);
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [isHydrated]);

    useEffect(() => {
        if (!isAuthReady) return;

        if (!hasSession) {
            setEntitlementStatus('idle');
            setEntitlementState('unknown');
            return;
        }

        if (env.ALLOW_PAYMENT_BYPASS) {
            setEntitlementStatus('active');
            setEntitlementState('active');
            return;
        }

        const appUserId = (user as any)?.id as string | undefined;
        if (!appUserId) {
            setEntitlementStatus('error');
            setEntitlementState('unknown');
            return;
        }

        let cancelled = false;

        const runCheck = async () => {
            setEntitlementStatus('checking');

            const verification = await verifyEntitlementWithBackend({ appUserId });
            if (cancelled) return;

            if (verification.success && verification.active) {
                setEntitlementStatus('active');
                setEntitlementState('active');
                return;
            }

            // Product rule: do not lock app access when entitlement is inactive.
            // Keep dashboard accessible and show renewal warning in Home.
            if (verification.success && !verification.active) {
                setEntitlementStatus('inactive');
                setEntitlementState('inactive');
                return;
            }

            setEntitlementStatus('error');
            setEntitlementState('unknown');
        };

        runCheck().catch((error) => {
            if (cancelled) return;
            console.warn('⚠️ Entitlement check failed in RootNavigator', error);
            setEntitlementStatus('error');
            setEntitlementState('unknown');
        });

        return () => {
            cancelled = true;
        };
    }, [
        hasSession,
        isAuthReady,
        setEntitlementState,
        user,
    ]);

    if (!isAuthReady && !hydrationTimeout) {
        console.log('⏳ RootNavigator: Waiting for Auth Bootstrap...');
        return null;
    }

    if (hasSession && !env.ALLOW_PAYMENT_BYPASS && (entitlementStatus === 'idle' || entitlementStatus === 'checking')) {
        return null;
    }

    const shouldShowMainNavigator = hasSession && (showDashboard || hasCompletedOnboarding);

    return (
        <AudioProvider>
            <TexturedBackground style={{ flex: 1 }}>
                {shouldShowMainNavigator ? (
                    <MainNavigator />
                ) : (
                    <OnboardingNavigator initialRouteName="Intro" />
                )}
            </TexturedBackground>
        </AudioProvider>
    );
};
