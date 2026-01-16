import React, { useMemo, useEffect, useState } from 'react';
import { View, Alert, TouchableOpacity, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { useSupabaseAuthBootstrap } from '@/hooks/useSupabaseAuthBootstrap';
import { useSupabaseLibraryAutoSync } from '@/hooks/useSupabaseLibraryAutoSync';
import { TexturedBackground } from '@/components/TexturedBackground';
import { SignInScreen } from '@/screens/auth/SignInScreen';
// Onboarding screens
import { IntroScreen } from '@/screens/onboarding/IntroScreen';
import { RelationshipScreen } from '@/screens/onboarding/RelationshipScreen';
import { BirthInfoScreen } from '@/screens/onboarding/BirthInfoScreen';
import { LanguagesScreen } from '@/screens/onboarding/LanguagesScreen';
// CurrentCityScreen removed from onboarding flow
import { AccountScreen } from '@/screens/onboarding/AccountScreen';
import { NameInputScreen } from '@/screens/onboarding/NameInputScreen';
import { FreeReadingSelectionScreen } from '@/screens/onboarding/FreeReadingSelectionScreen';
import { CoreIdentitiesScreen } from '@/screens/onboarding/CoreIdentitiesScreen';
import { HookSequenceScreen } from '@/screens/onboarding/HookSequenceScreen';
import { PostHookOfferScreen } from '@/screens/onboarding/PostHookOfferScreen';
import { AddThirdPersonPromptScreen } from '@/screens/onboarding/AddThirdPersonPromptScreen';
// ... imports ...

export type OnboardingStackParamList = {
  Intro: undefined;
  SignIn: undefined;
  Relationship: undefined;
  BirthInfo: undefined;
  CurrentCity: undefined;
  Languages: undefined;
  NameInput: { postPurchase?: boolean } | undefined;
  FreeReadingSelection: undefined;
  Account: { postPurchase?: boolean } | undefined;
  CoreIdentities: undefined;
  CoreIdentitiesIntro: undefined;
  HookSequence: {
    initialReading?: 'sun' | 'moon' | 'rising';
    customReadings?: any[]; // Hook readings to display instead of from store
    personName?: string; // Name of person whose readings are shown
  } | undefined;
  OnboardingComplete: undefined;
  PostHookOffer: undefined; // New screen
  AddThirdPersonPrompt: undefined;
  // Reuse existing “home” screens inside onboarding flow (pre-payment)
  PartnerInfo: { mode?: string; returnTo?: string } | undefined;
  PartnerCoreIdentities: any;
  PartnerReadings: any;
  SynastryPreview: any;
  Purchase: any;
};

// ...



// Main screens
import { HomeScreen } from '@/screens/home/HomeScreen';
import { YourChartScreen } from '@/screens/home/YourChartScreen';
import { MatchesScreen } from '@/screens/home/MatchesScreen';
import { MatchDetailScreen } from '@/screens/home/MatchDetailScreen';
import { GalleryScreen } from '@/screens/social/GalleryScreen';
import { ChatListScreen } from '@/screens/social/ChatListScreen';
import { ChatScreen } from '@/screens/social/ChatScreen';
import { MatchRevealScreen } from '@/screens/social/MatchRevealScreen';
import { PartnerInfoScreen } from '@/screens/home/PartnerInfoScreen';
import { PartnerCoreIdentitiesScreen } from '@/screens/home/PartnerCoreIdentitiesScreen';
import { PartnerReadingsScreen } from '@/screens/home/PartnerReadingsScreen';
import { SynastryPreviewScreen } from '@/screens/home/SynastryPreviewScreen';
import { SynastryOptionsScreen } from '@/screens/home/SynastryOptionsScreen';
import { SystemSelectionScreen } from '@/screens/home/SystemSelectionScreen';
import { GeneratingReadingScreen } from '@/screens/home/GeneratingReadingScreen';
import { ExtendedPromptScreen } from '@/screens/home/ExtendedPromptScreen';
import { ExtendedReadingScreen } from '@/screens/home/ExtendedReadingScreen';
import { FullReadingRedirectScreen } from '@/screens/home/FullReadingRedirectScreen';
import { CompleteReadingScreen } from '@/screens/home/CompleteReadingScreen';
import { ReadingSummaryScreen } from '@/screens/home/ReadingSummaryScreen';
import ReadingOverviewScreen from '@/screens/home/ReadingOverviewScreen';
import { SavedReadingScreen } from '@/screens/home/SavedReadingScreen';
import { SystemOverviewScreen } from '@/screens/home/SystemOverviewScreen';
import { EditBirthDataScreen } from '@/screens/home/EditBirthDataScreen';
import { JobDetailScreen } from '@/screens/home/JobDetailScreen';
import { DeepReadingReaderScreen } from '@/screens/home/DeepReadingReaderScreen';
import { OverlayReaderScreen } from '@/screens/home/OverlayReaderScreen';
import { PeopleListScreen } from '@/screens/home/PeopleListScreen';
import { PersonProfileScreen } from '@/screens/home/PersonProfileScreen';
import { PersonJobsListScreen } from '@/screens/home/PersonJobsListScreen';
import { PersonReadingsScreen } from '@/screens/home/PersonReadingsScreen';
import { PersonReadingChaptersFlowScreen } from '@/screens/home/PersonReadingChaptersFlowScreen';
import { ReadingChapterScreen } from '@/screens/home/ReadingChapterScreen';
import { MyLibraryScreen } from '@/screens/home/MyLibraryScreen';
import { NextStepScreen } from '@/screens/home/NextStepScreen';
import { TreeOfLifeVideoScreen } from '@/screens/home/TreeOfLifeVideoScreen';
import { ComparePeopleScreen } from '@/screens/home/ComparePeopleScreen';
import { SystemsOverviewScreen } from '@/screens/home/SystemsOverviewScreen';
import { AudioPlayerScreen } from '@/screens/home/AudioPlayerScreen';
import { RelationshipContextScreen } from '@/screens/home/RelationshipContextScreen';
import { PersonalContextScreen } from '@/screens/home/PersonalContextScreen';
import { VoiceSelectionScreen } from '@/screens/home/VoiceSelectionScreen';
import { SynastryOverlayScreen } from '@/screens/premium/SynastryOverlayScreen';
import { PurchaseScreen } from '@/screens/premium/PurchaseScreen';
import { HowMatchingWorksScreen } from '@/screens/home/HowMatchingWorksScreen';
import { ChartCalculationScreen } from '@/screens/home/ChartCalculationScreen';
// KYC screens (disabled for now - sleeping until needed)
// import { KYCIntroScreen } from '@/screens/kyc/KYCIntroScreen';
// import { KYCPhoneScreen } from '@/screens/kyc/KYCPhoneScreen';
// import { KYCDocumentScreen } from '@/screens/kyc/KYCDocumentScreen';
// import { KYCFaceScanScreen } from '@/screens/kyc/KYCFaceScanScreen';
// import { KYCCompleteScreen } from '@/screens/kyc/KYCCompleteScreen';
// Learn screens
import { SystemExplainerScreen } from '@/screens/learn/SystemExplainerScreen';
import { WhyDifferentScreen } from '@/screens/learn/WhyDifferentScreen';
// Settings screens
import {
  SettingsScreen,
  PrivacyPolicyScreen,
  TermsOfServiceScreen,
  AccountDeletionScreen,
  DataPrivacyScreen,
  ContactSupportScreen,
  AboutScreen
} from '@/screens/settings';
import { BirthChart, ProductId } from '@/types/api';
import { CityOption } from '@/types/forms';



export type MainStackParamList = {
  Home: undefined;
  NextStep: undefined;
  ComparePeople: undefined;
  ProfileSignIn: undefined;
  HowMatchingWorks: undefined;
  HookSequence: {
    initialReading?: 'sun' | 'moon' | 'rising';
    customReadings?: any[]; // Hook readings to display instead of from store
    personName?: string; // Name of person whose readings are shown
  } | undefined;
  HookPreview: {
    initialReading?: 'sun' | 'moon' | 'rising';
    customReadings: any[]; // Required for preview
    personName: string; // Required for title
  };
  SystemsOverview: {
    forPartner?: boolean;
    partnerName?: string;
    partnerBirthDate?: string;
    partnerBirthTime?: string | null;
    partnerBirthCity?: CityOption | null;
  } | undefined;
  MyLibrary: undefined;
  YourChart: undefined;
  ChartCalculation: { personId?: string } | undefined;
  Matches: undefined;
  MatchDetail: { matchId: string };
  Gallery: undefined;
  ChatList: undefined;
  Chat: {
    conversationId: string;
    otherName: string;
    otherClaymationUrl: string | null;
  };
  MatchReveal: {
    matchId: string;
    otherName: string;
    otherClaymationUrl: string | null;
    userName: string;
    userClaymationUrl: string | null;
    compatibilityScore?: number;
    matchReason?: string;
    conversationId: string;
  };
  PartnerInfo: { mode?: 'add_person_only'; returnTo?: 'ComparePeople' } | undefined;
  PartnerCoreIdentities: {
    partnerName: string;
    partnerBirthDate?: string | undefined;
    partnerBirthTime?: string | null | undefined;
    partnerBirthCity?: CityOption | null | undefined;
  };
  PartnerReadings: {
    partnerName: string;
    partnerBirthDate?: string | undefined;
    partnerBirthTime?: string | null | undefined;
    partnerBirthCity?: CityOption | null | undefined;
    partnerId?: string;
  };
  SynastryPreview: {
    partnerName?: string;
    partnerBirthDate?: string;
    partnerBirthTime?: string | null;
    partnerBirthCity?: CityOption | null;
  };
  SynastryOptions: {
    partnerName: string;
    partnerBirthDate?: string | undefined;
    partnerBirthTime?: string | null | undefined;
    partnerBirthCity?: CityOption | null | undefined;
  } | undefined;
  RelationshipContext: {
    partnerName: string;
    readingType: 'individual' | 'overlay';
    forPartner: boolean;
    userName: string;
    partnerBirthDate?: string;
    partnerBirthTime?: string | null;
    partnerBirthCity?: CityOption | null;
    personId?: string;
    preselectedSystem?: string;
    person1Override?: {
      name: string;
      birthDate: string;
      birthTime: string;
      timezone: string;
      latitude: number;
      longitude: number;
    };
    person2Override?: {
      name: string;
      birthDate: string;
      birthTime: string;
      timezone: string;
      latitude: number;
      longitude: number;
    };
  };
  PersonalContext: {
    personName: string;
    readingType: 'self' | 'other';
    forPartner?: boolean;
    userName?: string;
    personBirthDate?: string;
    personBirthTime?: string | null;
    personBirthCity?: CityOption | null;
    personId?: string;
    preselectedSystem?: string; // Optional: pre-select a system in SystemSelection
    person1Override?: {
      name: string;
      birthDate: string;
      birthTime: string;
      timezone: string;
      latitude: number;
      longitude: number;
    };
  };
  SystemSelection: {
    // Standard params
    readingType: 'individual' | 'overlay';
    forPartner: boolean;
    userName: string;
    partnerName?: string;
    partnerBirthDate?: string;
    partnerBirthTime?: string | null;
    partnerBirthCity?: CityOption | null;
    relationshipContext?: string; // Optional context from RelationshipContext screen (for overlays)
    personalContext?: string; // Optional context from PersonalContext screen (for individual readings)
    preselectedSystem?: string; // NEW: If system was already chosen in SystemExplainer, skip system selection UI

    // NEW: Direct person lookup (skips providing all details manually)
    personId?: string;

    // Optional overrides for "two other people" flows (neither is the main user).
    person1Override?: {
      name: string;
      birthDate: string;
      birthTime: string;
      timezone: string;
      latitude: number;
      longitude: number;
    };
    person2Override?: {
      name: string;
      birthDate: string;
      birthTime: string;
      timezone: string;
      latitude: number;
      longitude: number;
    };
  };
  VoiceSelection: {
    onSelect: (voiceId: string) => void;
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
  };
  GeneratingReading: {
    productType: string;
    productName: string;
    personName?: string;
    partnerName?: string;
    personId?: string;
    partnerId?: string;
    jobId?: string;
    systems?: string[];
    readingType?: 'individual' | 'overlay';
    forPartner?: boolean;
  };
  ExtendedPrompt: undefined;
  ExtendedReading: undefined;
  FullReading: {
    system?: string;
    forPartner?: boolean;
    partnerName?: string;
    partnerBirthDate?: string;
    partnerBirthTime?: string | null;
    partnerBirthCity?: CityOption | null;
  };
  SavedReading: { personId: string; readingId: string };
  SystemOverview: { personId: string; system: string };
  EditBirthData: { personId?: string } | undefined;
  JobDetail: { jobId: string };
  DeepReadingReader: { jobId: string };
  OverlayReader: { jobId: string };
  CompleteReading: {
    partnerName?: string;
    partnerBirthDate?: string;
    partnerBirthTime?: string | null;
    partnerBirthCity?: CityOption | null;
  } | undefined;
  ReadingOverview: {
    title?: string;
    person1Name?: string;
    person2Name?: string;
    person1?: {
      name: string;
      birthDate: string;
      birthTime: string;
      timezone: string;
      latitude: number;
      longitude: number;
    };
    person2?: {
      name: string;
      birthDate: string;
      birthTime: string;
      timezone: string;
      latitude: number;
      longitude: number;
    };
    productType?: string;
    systems?: string[];
    readingType?: 'individual' | 'overlay';
  } | undefined;
  ReadingSummary: {
    readingType?: string;
    person1Name?: string;
    person2Name?: string;
    overallScore?: number;
    highlights?: Array<{ icon: string; text: string }>;
    wordCount?: number;
    readingId?: string;
  };
  PeopleList: { mode?: 'view' | 'select'; returnTo?: keyof MainStackParamList } | undefined;
  PersonProfile: { personId: string };
  PersonJobsList: { personName: string; personId: string };
  PersonReadings: { personName: string; personId: string; personType: 'person1' | 'person2' | 'overlay' | 'individual'; jobId?: string };
  ReadingChapter: {
    personName: string;
    personId?: string;
    jobId: string;
    systemId: string;
    systemName: string;
    docNum: number;
    timestamp?: string;
    nextChapter?: any;
  };
  SynastryOverlay: {
    userId: string;
    user1: { name: string; birthChart: BirthChart };
    user2: { name: string; birthChart: BirthChart };
    person1Id?: string;
    person2Id?: string;
  };
  Purchase: {
    userId?: string;
    preselectedProduct?: ProductId;
    onPurchaseComplete?: () => void;
    mode?: 'user_readings' | 'partner_readings' | 'overlays' | 'nuclear' | 'all';
    partnerName?: string;
  };
  // KYC Screens (disabled - sleeping until needed)
  // KYCIntro: undefined;
  // KYCPhone: undefined;
  // KYCPhoto: undefined;
  // KYCDocument: undefined;
  // KYCFaceScan: undefined;
  // KYCComplete: undefined;
  // Learn Screens
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
      name: string;
      birthDate: string;
      birthTime: string;
      timezone: string;
      latitude: number;
      longitude: number;
    };
    person2Override?: {
      name: string;
      birthDate: string;
      birthTime: string;
      timezone: string;
      latitude: number;
      longitude: number;
    };
  };
  WhyDifferent: undefined;
  // Audio Player
  AudioPlayer: {
    audioUrl?: string;
    title?: string;
    personName?: string;
    system?: string;
    readingId?: string;
    readingText?: string; // If provided, will generate audio on the player screen
    playlist?: Array<{
      title: string;
      audioUrl: string;
      system?: string;
      headlineText?: string;
      systemBlurbText?: string;
    }>;
    startIndex?: number;
    seriesIntroText?: string;
  };
  // Settings Screens
  Settings: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  AccountDeletion: undefined;
  DataPrivacy: undefined;
  ContactSupport: undefined;
  About: undefined;
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

// Wrapper for SignInScreen in onboarding flow (respects route params)
const SignInScreenWrapper = ({ route }: any) => (
  <SignInScreen route={route} />
);

// Wrapper for SignInScreen inside Main flow (returning users - sign-in only)
const MainSignInScreenWrapper = ({ navigation }: any) => {
  console.log('🚨 MainSignInScreenWrapper RENDERED (ProfileSignIn) - Something navigated here!');
  return <SignInScreen route={{ params: { allowSignUp: false } }} />;
};

const OnboardingNavigator = ({ initialRouteName = "Intro" }: { initialRouteName?: keyof OnboardingStackParamList }) => {
  const { signOut } = useAuthStore();
  const navigation = useNavigation();

  return (
    <OnboardingStack.Navigator
      screenOptions={{
        headerShown: false,
        // CRITICAL: native-stack paints an opaque scene background by default.
        // Keep it transparent so TexturedBackground always shows through.
        contentStyle: { backgroundColor: 'transparent' },
      }}
      initialRouteName={initialRouteName}
    >
      <OnboardingStack.Screen name="Intro" component={IntroScreen} />
      <OnboardingStack.Screen name="SignIn" component={SignInScreenWrapper} />
      <OnboardingStack.Screen name="Relationship" component={RelationshipScreen} />
      <OnboardingStack.Screen name="BirthInfo" component={BirthInfoScreen} />
      <OnboardingStack.Screen name="Languages" component={LanguagesScreen} />
      <OnboardingStack.Screen name="NameInput" component={NameInputScreen} />
      <OnboardingStack.Screen name="FreeReadingSelection" component={FreeReadingSelectionScreen} />
      <OnboardingStack.Screen name="Account" component={AccountScreen} />
      <OnboardingStack.Screen name="CoreIdentities" component={CoreIdentitiesScreen} />
      <OnboardingStack.Screen name="HookSequence" component={HookSequenceScreen} />
      <OnboardingStack.Screen name="AddThirdPersonPrompt" component={AddThirdPersonPromptScreen} />
      {/* Partner flow screens reused during onboarding */}
      <OnboardingStack.Screen name="PartnerInfo" component={PartnerInfoScreen as any} />
      <OnboardingStack.Screen name="PartnerCoreIdentities" component={PartnerCoreIdentitiesScreen as any} />
      <OnboardingStack.Screen name="PartnerReadings" component={PartnerReadingsScreen as any} />
      <OnboardingStack.Screen name="SynastryPreview" component={SynastryPreviewScreen as any} />
      <OnboardingStack.Screen name="Purchase" component={PurchaseScreen as any} />

      <OnboardingStack.Screen name="PostHookOffer" component={PostHookOfferScreen} />
    </OnboardingStack.Navigator>
  );
};

const MainNavigator = () => {
  // Check if we need to redirect to a specific screen after onboarding
  const redirectAfterOnboarding = useOnboardingStore((s: any) => s.redirectAfterOnboarding);
  const initialRoute = redirectAfterOnboarding || 'Home';
  console.log(`🚀 MainNavigator MOUNTED - initialRouteName=${initialRoute}`);

  // After resets, onboarding birth data can exist while profileStore user is missing birthTime.
  // Compatibility requires birth time, so hydrate/update profileStore user from onboardingStore here.
  const onboardingBirthDate = useOnboardingStore((s: any) => s.birthDate);
  const onboardingBirthTime = useOnboardingStore((s: any) => s.birthTime);
  const onboardingBirthCity = useOnboardingStore((s: any) => s.birthCity);
  const displayName = useAuthStore((s: any) => s.displayName);

  const getUser = useProfileStore((s) => s.getUser);
  const addPerson = useProfileStore((s) => s.addPerson);
  const updatePerson = useProfileStore((s) => s.updatePerson);

  const setRedirectAfterOnboarding = useOnboardingStore((s: any) => s.setRedirectAfterOnboarding);
  const navigation = useNavigation();

  useEffect(() => {
    if (redirectAfterOnboarding) {
      console.log(`🔀 Redirecting to ${redirectAfterOnboarding} after onboarding...`);
      // Navigate immediately to prevent dashboard flash
      // @ts-ignore
      navigation.navigate(redirectAfterOnboarding);
      setRedirectAfterOnboarding(null);
    }
  }, [redirectAfterOnboarding, setRedirectAfterOnboarding, navigation]);

  useEffect(() => {
    // ZOMBIE STATE PROTECTION MOVED TO HomeScreen
    // This check was interfering with the login flow by running too early
    // Now it only runs when user actually tries to access Home screen

    /* ORIGINAL CODE - DISABLED
    const user = useAuthStore.getState().user;
    const profileUser = useProfileStore.getState().getUser();
    const hasOnboardingData = !!useOnboardingStore.getState().birthDate;
 
    if (user && !profileUser && !hasOnboardingData) {
      console.log('🧟‍♂️ Zombie State Detected (Auth Yes, Profile No). Forcing Logout.');
      Alert.alert(
        'Account Not Found',
        'We could not find your profile. Please tap "Get Started" to set up your account.',
        [{ text: 'OK', onPress: () => useAuthStore.getState().signOut() }]
      );
      return;
    }
    */

    if (!onboardingBirthDate || !onboardingBirthTime || !onboardingBirthCity) return;

    const nextBirthData = {
      birthDate: onboardingBirthDate,
      birthTime: onboardingBirthTime,
      birthCity: onboardingBirthCity.name,
      timezone: onboardingBirthCity.timezone,
      latitude: onboardingBirthCity.latitude,
      longitude: onboardingBirthCity.longitude,
    };

    const currentProfile = getUser();
    if (!currentProfile) {
      // FIX: If no self profile exists (e.g. after fresh sign-in or data clear), create it now using the hydration data.
      // Do not abort. This prevents the "Zombie State" where auth exists but profile doesn't.
      console.log('⚠️ No self profile found. Creating new profile from sync data...');

      const onboardingHookReadings = useOnboardingStore.getState().hookReadings as any;
      const placementsFromHooks =
        onboardingHookReadings?.sun?.sign && onboardingHookReadings?.moon?.sign && onboardingHookReadings?.rising?.sign
          ? {
              sunSign: onboardingHookReadings.sun.sign,
              moonSign: onboardingHookReadings.moon.sign,
              risingSign: onboardingHookReadings.rising.sign,
            }
          : undefined;

      addPerson({
        name: displayName || 'You',
        isUser: true,
        birthData: nextBirthData,
        // Since we are hydrating from onboarding data, we assume these are the "truth"
        placements: placementsFromHooks, // Prefer hook-derived placements if available (prevents cloud overwrite to null)
      });
      return;
    }

    const needsBirthTime = !currentProfile.birthData?.birthTime || String(currentProfile.birthData.birthTime).trim().length === 0;
    const needsCity = !currentProfile.birthData?.birthCity || String(currentProfile.birthData.birthCity).trim().length === 0;
    const needsTimezone = !currentProfile.birthData?.timezone || String(currentProfile.birthData.timezone).trim().length === 0;
    const needsCoords = !Number.isFinite(currentProfile.birthData?.latitude) || !Number.isFinite(currentProfile.birthData?.longitude);
    const shouldUpdateName = currentProfile.name === 'You' && !!displayName && displayName !== 'You';

    if (needsBirthTime || needsCity || needsTimezone || needsCoords || shouldUpdateName) {
      console.log('✅ Updating existing self profile with onboarding data');
      updatePerson(currentProfile.id, {
        ...(shouldUpdateName ? { name: displayName! } : {}),
        birthData: nextBirthData,
      } as any);
    }
  }, [
    onboardingBirthDate,
    onboardingBirthTime,
    onboardingBirthCity?.name,
    onboardingBirthCity?.timezone,
    onboardingBirthCity?.latitude,
    onboardingBirthCity?.longitude,
    displayName,
    getUser,
    addPerson,
    updatePerson,
  ]);

  // AUTOMATIC CLEANUP: Remove incorrect self profiles based on calculated placements
  // This runs once on app mount to ensure only the correct Virgo Sun | Leo Moon | Sagittarius Rising profile exists
  // CRITICAL: Only run after store has fully hydrated from AsyncStorage to avoid operating on incomplete data
  const fixDuplicateIds = useProfileStore((s) => s.fixDuplicateIds);
  const removeIncorrectUserProfile = useProfileStore((s) => s.removeIncorrectUserProfile);
  const hasHydrated = useProfileStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) {
      console.log('⏳ Cleanup: Waiting for profile store hydration...');
      return;
    }

    console.log('✅ Cleanup: Store hydrated, running automatic cleanup...');
    
    // Fix duplicate IDs first (before any other cleanup)
    const idFixes = fixDuplicateIds();
    if (idFixes.fixedCount > 0) {
      console.log(`🔧 Fixed ${idFixes.fixedCount} duplicate ID(s)`);
    }
    
    // Then remove incorrect user profiles
    const result = removeIncorrectUserProfile();
    if (result.success && result.removedCount > 0) {
      console.log(`🧹 Removed ${result.removedCount} incorrect self profile(s)`);
    }
  }, [hasHydrated, fixDuplicateIds, removeIncorrectUserProfile]);

  // Sync hook readings from onboarding into user profile for carousel
  const hookReadings = useOnboardingStore((s: any) => s.hookReadings);
  const setHookReadings = useProfileStore((s) => s.setHookReadings);

  useEffect(() => {
    const user = getUser();
    if (!user) return;
    if (!hookReadings.sun || !hookReadings.moon || !hookReadings.rising) return;

    // Only sync if user doesn't have hook readings yet
    const existingHookReadings = user.hookReadings;
    if (existingHookReadings && existingHookReadings.length > 0) return;

    console.log('🔄 Syncing hook readings into user profile for carousel...');
    const { type: _sunType, ...sunRest } = hookReadings.sun as any;
    const { type: _moonType, ...moonRest } = hookReadings.moon as any;
    const { type: _risingType, ...risingRest } = hookReadings.rising as any;
    setHookReadings(user.id, [
      { ...sunRest, type: 'sun' as const, generatedAt: new Date().toISOString() },
      { ...moonRest, type: 'moon' as const, generatedAt: new Date().toISOString() },
      { ...risingRest, type: 'rising' as const, generatedAt: new Date().toISOString() },
    ]);
    console.log('✅ Hook readings synced for carousel');
  }, [hookReadings.sun, hookReadings.moon, hookReadings.rising, getUser, setHookReadings]);

  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Same deal here: ensure the scene background never blocks the leather texture.
        contentStyle: { backgroundColor: 'transparent' },
      }}
      initialRouteName={initialRoute as keyof MainStackParamList}
    >
      <MainStack.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen name="NextStep" component={NextStepScreen} />
      <MainStack.Screen name="ComparePeople" component={ComparePeopleScreen} />
      <MainStack.Screen name="ProfileSignIn" component={MainSignInScreenWrapper} options={{ presentation: 'fullScreenModal' }} />
      <MainStack.Screen name="SystemsOverview" component={SystemsOverviewScreen} />
      <MainStack.Screen name="MyLibrary" component={MyLibraryScreen} />
      <MainStack.Screen name="YourChart" component={YourChartScreen} />
      <MainStack.Screen name="ChartCalculation" component={ChartCalculationScreen} />
      <MainStack.Screen name="Matches" component={MatchesScreen} />
      <MainStack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <MainStack.Screen name="Gallery" component={GalleryScreen} />
      <MainStack.Screen name="ChatList" component={ChatListScreen} />
      <MainStack.Screen name="Chat" component={ChatScreen} />
      <MainStack.Screen name="MatchReveal" component={MatchRevealScreen} options={{ presentation: 'fullScreenModal' }} />
      <MainStack.Screen name="PartnerInfo" component={PartnerInfoScreen} />
      <MainStack.Screen name="PartnerCoreIdentities" component={PartnerCoreIdentitiesScreen} />
      <MainStack.Screen name="PartnerReadings" component={PartnerReadingsScreen} />
      <MainStack.Screen name="SynastryPreview" component={SynastryPreviewScreen} />
      <MainStack.Screen name="SynastryOptions" component={SynastryOptionsScreen} />
      <MainStack.Screen name="RelationshipContext" component={RelationshipContextScreen} />
      <MainStack.Screen name="PersonalContext" component={PersonalContextScreen} />
      <MainStack.Screen name="SystemSelection" component={SystemSelectionScreen} />
      <MainStack.Screen name="VoiceSelection" component={VoiceSelectionScreen} />
      <MainStack.Screen name="TreeOfLifeVideo" component={TreeOfLifeVideoScreen} />
      <MainStack.Screen name="GeneratingReading" component={GeneratingReadingScreen} />
      <MainStack.Screen name="ExtendedPrompt" component={ExtendedPromptScreen} />
      <MainStack.Screen name="ExtendedReading" component={ExtendedReadingScreen} />
      <MainStack.Screen name="FullReading" component={FullReadingRedirectScreen} />
      <MainStack.Screen name="SavedReading" component={SavedReadingScreen} />
      <MainStack.Screen name="SystemOverview" component={SystemOverviewScreen} />
      <MainStack.Screen name="EditBirthData" component={EditBirthDataScreen} />
      <MainStack.Screen name="JobDetail" component={JobDetailScreen} />
      <MainStack.Screen name="DeepReadingReader" component={DeepReadingReaderScreen} />
      <MainStack.Screen name="OverlayReader" component={OverlayReaderScreen} />
      <MainStack.Screen name="CompleteReading" component={CompleteReadingScreen} />
      <MainStack.Screen name="ReadingSummary" component={ReadingSummaryScreen} />
      <MainStack.Screen name="ReadingOverview" component={ReadingOverviewScreen} />
      <MainStack.Screen name="PeopleList" component={PeopleListScreen} />
      <MainStack.Screen name="PersonProfile" component={PersonProfileScreen} />
      <MainStack.Screen name="PersonJobsList" component={PersonJobsListScreen} />
      {/* Keep route name the same so MyLibrary/MySourceLibrary stays untouched */}
      <MainStack.Screen name="PersonReadings" component={PersonReadingChaptersFlowScreen} />
      <MainStack.Screen name="ReadingChapter" component={ReadingChapterScreen} />
      <MainStack.Screen name="SynastryOverlay" component={SynastryOverlayScreen} />
      <MainStack.Screen name="Purchase" component={PurchaseScreen} />
      {/* KYC Screens (disabled - sleeping until needed) */}
      {/* <MainStack.Screen name="KYCIntro" component={KYCIntroScreen} /> */}
      {/* <MainStack.Screen name="KYCPhone" component={KYCPhoneScreen} /> */}
      {/* <MainStack.Screen name="KYCDocument" component={KYCDocumentScreen} /> */}
      {/* <MainStack.Screen name="KYCFaceScan" component={KYCFaceScanScreen} /> */}
      {/* <MainStack.Screen name="KYCComplete" component={KYCCompleteScreen} /> */}
      {/* Learn Screens */}
      <MainStack.Screen name="SystemExplainer" component={SystemExplainerScreen} />
      <MainStack.Screen name="WhyDifferent" component={WhyDifferentScreen} />
      {/* Audio Player */}
      <MainStack.Screen name="AudioPlayer" component={AudioPlayerScreen} options={{ presentation: 'modal' }} />
      {/* Settings Screens */}
      <MainStack.Screen name="Settings" component={SettingsScreen} />
      <MainStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <MainStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <MainStack.Screen name="AccountDeletion" component={AccountDeletionScreen} />
      <MainStack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
      <MainStack.Screen name="ContactSupport" component={ContactSupportScreen} />
      <MainStack.Screen name="About" component={AboutScreen} />
    </MainStack.Navigator>
  );
};

// ... imports ...

export const RootNavigator = () => {
  const user = useAuthStore((state: any) => state.user);
  const isLoading = useAuthStore((state: any) => state.isLoading);
  const isAuthReady = useAuthStore((state: any) => state.isAuthReady);

  // 1. Hydrate authStore from persisted Supabase session
  useSupabaseAuthBootstrap();

  // 2. Keep local library synced
  useSupabaseLibraryAutoSync();

  // ============================================================================
  // ROUTING INVARIANT (DO NOT MODIFY)
  // ============================================================================
  // RULE: Supabase session existence is the ONLY authority for routing.
  // 
  // if (session exists) → MainNavigator (Dashboard)
  // else → OnboardingNavigator (Intro)
  //
  // Onboarding state, profile existence, or screen context MUST NEVER affect
  // this routing decision. Profile creation and updates run asynchronously
  // in the background without blocking UI.
  //
  // This invariant prevents infinite loops and ensures predictable navigation.
  // ============================================================================

  const hasSession = !!user;
  // Onboarding state - check if user has completed onboarding
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const showDashboard = useOnboardingStore((s) => s.showDashboard); // Flag to switch navigators
  const hookReadings = useOnboardingStore((s) => s.hookReadings);
  const hasHookReadings = !!(hookReadings?.sun && hookReadings?.moon && hookReadings?.rising);
  const onboardingBirthDate = useOnboardingStore((s: any) => s.birthDate);
  const onboardingBirthTime = useOnboardingStore((s: any) => s.birthTime);
  const onboardingBirthCity = useOnboardingStore((s: any) => s.birthCity);
  const primaryLanguage = useOnboardingStore((s: any) => s.primaryLanguage);
  const isHydrated = useOnboardingStore((s) => s._hasHydrated);

  console.log('🧭 RootNavigator State:', {
    isLoading,
    hasSession,
    hasUser: !!user,
    hasHookReadings,
    isHydrated,
    hasCompletedOnboarding,
    showDashboard
  });

  // Block rendering until Bootstrap determines if we have a valid session AND persist has hydrated
  // Add a timeout fallback to prevent infinite loading
  const [hydrationTimeout, setHydrationTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isHydrated) {
        console.warn('⚠️ RootNavigator: Hydration timeout - proceeding anyway');
        setHydrationTimeout(true);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timer);
  }, [isHydrated]);

  if ((!isAuthReady || !isHydrated) && !hydrationTimeout) {
    console.log('⏳ RootNavigator: Waiting for Auth Bootstrap and Store Hydration...');
    return null;
  }

  // ROUTING LOGIC:
  // 1. No session → Onboarding (Intro)
  // 2. Session + Onboarding incomplete → Continue onboarding (CoreIdentities → HookSequence)
  // 3. Session + Onboarding complete → Dashboard

  // CRITICAL FIX: Continue onboarding if not completed, regardless of whether readings exist
  // Readings may be generated but user still needs to see HookSequence screen
  const shouldContinueOnboarding = hasSession && !hasCompletedOnboarding;

  if (shouldContinueOnboarding) {
    // Resume onboarding at the earliest missing step (never skip required screens).
    // Order: BirthInfo → Languages → CoreIdentities → HookSequence
    // 
    // IMPORTANT: If user has hook readings from Supabase, they MUST have birth data
    // (can't generate readings without it). Skip BirthInfo check to avoid timing issues
    // where Supabase data hasn't hydrated to local store yet.
    const initialRoute =
      hasHookReadings
        ? 'HookSequence' // User has readings → skip to HookSequence (birth data must exist in Supabase)
        : !onboardingBirthDate || !onboardingBirthTime || !onboardingBirthCity
          ? 'BirthInfo'
          : !primaryLanguage
            ? 'Languages'
            : 'CoreIdentities';
    console.log(`🔄 ROUTING: Session exists but onboarding incomplete → Continue to ${initialRoute}`);    
    return (
      <TexturedBackground style={{ flex: 1 }}>
        <OnboardingNavigator initialRouteName={initialRoute} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' }} />
      </TexturedBackground>
    );
  }

  // INVARIANT ASSERTION: Warn if session exists but we're about to render onboarding
  if (hasSession) {
    console.log('✅ INVARIANT: Session exists + Onboarding complete → Rendering MainNavigator (Dashboard)');  } else {
    console.log('✅ INVARIANT: No session → Rendering OnboardingNavigator (Intro)');  }

  return (
    <TexturedBackground style={{ flex: 1 }}>
      {hasSession && hasCompletedOnboarding ? (
        // Logged-in users with completed onboarding go straight to MainNavigator.
        <MainNavigator />
      ) : hasSession ? (
        // Session exists but onboarding incomplete → Continue onboarding
        <OnboardingNavigator initialRouteName={initialRoute} />
      ) : (
        // No session → Intro (Screen 1)
        <OnboardingNavigator initialRouteName="Intro" />
      )}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' }} />
    </TexturedBackground>
  );
};
