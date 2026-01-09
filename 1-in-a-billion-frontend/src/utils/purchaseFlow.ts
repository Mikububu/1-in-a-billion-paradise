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
 * FLOW: SystemExplainer → Purchase → Context Injection → VoiceSelection → GeneratingReading
 */
export function initiatePurchaseFlow(params: PurchaseFlowParams) {
  const { navigation, productType, readingType, systems, personName, userName, partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity, person1Override, person2Override, personId, partnerId, forPartner } = params;
  
  const isOverlay = readingType === 'overlay';
  
  // STEP 1: Navigate to Purchase (Payment) screen
  // Purchase screen will navigate to Context Injection after payment completes
  navigation.navigate('Purchase', {
    // Mode determines what products to show
    mode: isOverlay ? 'overlays' : 'user_readings',
    partnerName,
    // Pass all params needed for next steps after purchase
    afterPurchaseParams: {
      readingType,
      productType,
      systems,
      personName,
      userName,
      partnerName,
      partnerBirthDate,
      partnerBirthTime,
      partnerBirthCity,
      person1Override,
      person2Override,
      personId,
      partnerId,
      forPartner,
    },
  } as any);
  
  // STEP 2: Purchase screen will navigate to RelationshipContext (overlay) or PersonalContext (individual)
  // STEP 3: Context screens will navigate to VoiceSelection
  // STEP 4: VoiceSelection will start the job and navigate to GeneratingReading
}

/**
 * Check if we should skip system selection
 * (used when systems are already predetermined, like in Complete Reading)
 */
export function shouldSkipSystemSelection(systems: string[]): boolean {
  // If systems are already specified (e.g., all 5 for complete reading), skip system selection
  return systems.length > 0;
}
