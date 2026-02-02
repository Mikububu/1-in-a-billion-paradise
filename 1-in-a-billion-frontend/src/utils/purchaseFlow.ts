/**
 * CENTRALIZED PURCHASE FLOW
 * 
 * Modular system for all reading purchases.
 * Ensures consistent flow: Overview → Circle Injection → Voice Selection → Job Start
 * 
 * Usage: Call `initiatePurchaseFlow()` from ANY purchase button to start the flow.
 */

import { NavigationProp } from '@react-navigation/native';
import { MainStackParamList } from '@/navigation/RootNavigator';

export type ReadingType = 'individual' | 'overlay';
export type ReadingProduct = 'single_system' | 'complete_reading' | 'nuclear_package' | 'compatibility_overlay';

interface PurchaseFlowParams {
  navigation: NavigationProp<MainStackParamList>;
  productType: ReadingProduct;
  readingType: ReadingType;
  systems: string[]; // e.g., ['western'] or ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah']
  
  // Person data
  personName?: string;
  userName?: string;
  partnerName?: string;
  partnerBirthDate?: string;
  partnerBirthTime?: string;
  partnerBirthCity?: any;
  
  // Overrides for "two other people" flows
  person1Override?: any;
  person2Override?: any;
  
  // IDs
  personId?: string;
  partnerId?: string;
  
  // Context
  forPartner?: boolean;
}

/**
 * Initiate the standard purchase flow
 * ALL purchase buttons should call this function
 * 
 * FLOW: SystemExplainer → (Payment on button) → Context Injection → VoiceSelection → GeneratingReading
 */
export function initiatePurchaseFlow(params: PurchaseFlowParams) {
  const { navigation, productType, readingType, systems, personName, userName, partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity, person1Override, person2Override, personId, partnerId, forPartner } = params;
  
  const isOverlay = readingType === 'overlay';
  
  // STEP 1: Navigate to Circle Injection (Payment is handled by the button that calls this)
  if (isOverlay && partnerName) {
    // Overlay reading → RelationshipContext
    navigation.navigate('RelationshipContext', {
      readingType: 'overlay',
      forPartner: false,
      userName: userName || 'You',
      partnerName,
      partnerBirthDate,
      partnerBirthTime,
      partnerBirthCity,
      preselectedSystem: systems.length === 1 ? systems[0] : undefined,
      person1Override,
      person2Override,
      personId,
      partnerId,
      productType,
      systems,
    } as any);
  } else {
    // Individual reading → PersonalContext
    navigation.navigate('PersonalContext', {
      personName: personName || 'You',
      readingType: forPartner ? 'other' : 'self',
      personBirthDate: forPartner ? partnerBirthDate : undefined,
      personBirthTime: forPartner ? partnerBirthTime : undefined,
      personBirthCity: forPartner ? partnerBirthCity : undefined,
      preselectedSystem: systems.length === 1 ? systems[0] : undefined,
      person1Override,
      personId,
      productType,
      systems,
      forPartner,
    } as any);
  }
  
  // STEP 2: Context screens navigate to VoiceSelection (if productType & systems passed)
  // STEP 3: VoiceSelection starts the job and navigates to GeneratingReading
}

/**
 * Check if we should skip system selection
 * (used when systems are already predetermined, like in Complete Reading)
 */
export function shouldSkipSystemSelection(systems: string[]): boolean {
  // If systems are already specified (e.g., all 5 for complete reading), skip system selection
  return systems.length > 0;
}
