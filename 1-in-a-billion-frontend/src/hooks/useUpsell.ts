/**
 * UPSELL HOOK
 * 
 * Provides easy access to trigger upsells from anywhere in the app.
 * Manages modal state and handles tier selection.
 */

import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { type SubscriptionTier, type UpsellTrigger, SUBSCRIPTION_TIERS } from '../config/subscriptions';
import { useSubscriptionStore } from '../store/subscriptionStore';

export type UseUpsellReturn = {
  isVisible: boolean;
  currentTrigger: UpsellTrigger | null;
  showUpsell: (trigger: UpsellTrigger) => void;
  hideUpsell: () => void;
  handleSelectTier: (tier: SubscriptionTier) => void;
  checkAndShowUpsell: (action: UpsellTrigger) => boolean; // Returns true if upsell was shown
};

export function useUpsell(): UseUpsellReturn {
  const [isVisible, setIsVisible] = useState(false);
  const [currentTrigger, setCurrentTrigger] = useState<UpsellTrigger | null>(null);
  
  const subscriptionStore = useSubscriptionStore();
  const currentTier = subscriptionStore.tier;
  
  const showUpsell = useCallback((trigger: UpsellTrigger) => {
    setCurrentTrigger(trigger);
    setIsVisible(true);
  }, []);
  
  const hideUpsell = useCallback(() => {
    setIsVisible(false);
    // Keep trigger for animation out
    setTimeout(() => setCurrentTrigger(null), 300);
  }, []);
  
  const handleSelectTier = useCallback((tier: SubscriptionTier) => {
    const product = SUBSCRIPTION_TIERS[tier];
    
    // For now, show a placeholder alert - replace with actual IAP integration
    Alert.alert(
      `Upgrade to ${product.name}`,
      `$${product.priceMonthly}/month\n\nIn-app purchase integration coming soon!\n\nFeatures:\n${product.features.slice(0, 3).join('\n')}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Subscribe', 
          onPress: () => {
            // TODO: Integrate with Apple/Google IAP
            console.log(`[IAP] User selected tier: ${tier}, product: ${product.appleProductId || product.googleProductId}`);
            hideUpsell();
          }
        },
      ]
    );
  }, [hideUpsell]);
  
  /**
   * Check if action is allowed, show upsell if not
   * Returns true if upsell was shown (action blocked), false if action is allowed
   */
  const checkAndShowUpsell = useCallback((action: UpsellTrigger): boolean => {
    switch (action) {
      case 'add_first_person':
      case 'add_person_limit':
        if (!subscriptionStore.canAddPerson(0)) {
          showUpsell(action);
          return true;
        }
        return false;
        
      case 'deep_reading_limit':
        if (!subscriptionStore.canGenerateDeepReading()) {
          showUpsell(action);
          return true;
        }
        return false;
        
      case 'synastry_limit':
        if (!subscriptionStore.canGenerateSynastry()) {
          showUpsell(action);
          return true;
        }
        return false;
        
      case 'pdf_download':
        if (!subscriptionStore.canDownloadPDF()) {
          showUpsell(action);
          return true;
        }
        return false;
        
      // These triggers always show the upsell (soft upsells)
      case 'after_hook_sequence':
      case 'partner_deep_reading':
        showUpsell(action);
        return true;
        
      default:
        return false;
    }
  }, [subscriptionStore, showUpsell]);
  
  return {
    isVisible,
    currentTrigger,
    showUpsell,
    hideUpsell,
    handleSelectTier,
    checkAndShowUpsell,
  };
}

export default useUpsell;



