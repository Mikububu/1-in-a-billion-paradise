/**
 * UPSELL MODAL
 * 
 * Beautiful modal that appears at strategic points to encourage upgrades.
 * Designed with cosmic aesthetic - not generic AI slop.
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { 
  SUBSCRIPTION_TIERS, 
  UPSELL_MESSAGES, 
  type SubscriptionTier,
  type UpsellTrigger 
} from '../config/subscriptions';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type UpsellModalProps = {
  visible: boolean;
  trigger: UpsellTrigger;
  onClose: () => void;
  onSelectTier: (tier: SubscriptionTier) => void;
  currentTier?: SubscriptionTier;
};

// Cosmic color palette
const COLORS = {
  deepSpace: '#0a0a12',
  nebulaPurple: '#1a0a2e',
  cosmicGold: '#d4af37',
  starWhite: '#f8f8ff',
  softGlow: 'rgba(212, 175, 55, 0.15)',
  tierBasic: ['#1e3a5f', '#0d1b2a'],
  tierPro: ['#2d1b4e', '#1a0a2e'],
  tierCosmic: ['#1a1a2e', '#0a0a12'],
};

// Tier icons and colors
const TIER_CONFIG: Record<SubscriptionTier, { icon: string; gradient: string[]; accent: string }> = {
  free: { icon: '✨', gradient: ['#2a2a3a', '#1a1a2a'], accent: '#888' },
  basic: { icon: '🌟', gradient: ['#1e4d6b', '#0d2438'], accent: '#4da6ff' },
  pro: { icon: '🔮', gradient: ['#4a1e6b', '#2d0d38'], accent: '#b366ff' },
  cosmic: { icon: '🌌', gradient: ['#3d2e1a', '#1a1408'], accent: '#d4af37' },
};

export function UpsellModal({ 
  visible, 
  trigger, 
  onClose, 
  onSelectTier,
  currentTier = 'free' 
}: UpsellModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const starPulse = useRef(new Animated.Value(1)).current;
  
  const upsellInfo = UPSELL_MESSAGES[trigger];
  const suggestedTier = upsellInfo.suggestedTier;
  const suggestedProduct = SUBSCRIPTION_TIERS[suggestedTier];
  
  // Get tiers to display (suggested + next tier if available)
  const tiersToShow: SubscriptionTier[] = [suggestedTier];
  if (suggestedTier === 'basic') tiersToShow.push('pro');
  if (suggestedTier === 'pro') tiersToShow.push('cosmic');
  
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Pulsing stars effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(starPulse, {
            toValue: 1.2,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(starPulse, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible]);
  
  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
        
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <LinearGradient
            colors={[COLORS.nebulaPurple, COLORS.deepSpace]}
            style={styles.gradientBackground}
          >
            {/* Close button */}
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={COLORS.starWhite} />
            </Pressable>
            
            {/* Decorative stars */}
            <Animated.View style={[styles.starDecor, styles.star1, { transform: [{ scale: starPulse }] }]}>
              <Text style={styles.starText}>✦</Text>
            </Animated.View>
            <Animated.View style={[styles.starDecor, styles.star2, { transform: [{ scale: starPulse }] }]}>
              <Text style={styles.starText}>✧</Text>
            </Animated.View>
            <Animated.View style={[styles.starDecor, styles.star3, { transform: [{ scale: starPulse }] }]}>
              <Text style={styles.starText}>✦</Text>
            </Animated.View>
            
            {/* Header */}
            <View style={styles.headerSection}>
              <Text style={styles.headerIcon}>
                {TIER_CONFIG[suggestedTier].icon}
              </Text>
              <Text style={styles.headerTitle}>{upsellInfo.title}</Text>
              <Text style={styles.headerMessage}>{upsellInfo.message}</Text>
            </View>
            
            {/* Tier cards */}
            <View style={styles.tiersContainer}>
              {tiersToShow.map((tier, index) => {
                const product = SUBSCRIPTION_TIERS[tier];
                const config = TIER_CONFIG[tier];
                const isRecommended = tier === suggestedTier;
                
                return (
                  <Pressable
                    key={tier}
                    onPress={() => onSelectTier(tier)}
                    style={({ pressed }) => [
                      styles.tierCard,
                      isRecommended && styles.tierCardRecommended,
                      pressed && styles.tierCardPressed,
                    ]}
                  >
                    <LinearGradient
                      colors={config.gradient as [string, string]}
                      style={styles.tierCardGradient}
                    >
                      {isRecommended && (
                        <View style={[styles.recommendedBadge, { backgroundColor: config.accent }]}>
                          <Text style={styles.recommendedText}>RECOMMENDED</Text>
                        </View>
                      )}
                      
                      <View style={styles.tierHeader}>
                        <Text style={styles.tierIcon}>{config.icon}</Text>
                        <Text style={styles.tierName}>{product.name}</Text>
                        <Text style={[styles.tierTagline, { color: config.accent }]}>
                          {product.tagline}
                        </Text>
                      </View>
                      
                      <View style={styles.tierPricing}>
                        <Text style={styles.tierPrice}>
                          ${product.priceMonthly.toFixed(2)}
                        </Text>
                        <Text style={styles.tierPeriod}>/month</Text>
                      </View>
                      
                      <View style={styles.tierFeatures}>
                        {product.features.slice(0, 4).map((feature, i) => (
                          <View key={i} style={styles.featureRow}>
                            <Ionicons 
                              name="checkmark-circle" 
                              size={16} 
                              color={config.accent} 
                            />
                            <Text style={styles.featureText}>{feature}</Text>
                          </View>
                        ))}
                        {product.features.length > 4 && (
                          <Text style={[styles.moreFeatures, { color: config.accent }]}>
                            +{product.features.length - 4} more features
                          </Text>
                        )}
                      </View>
                      
                      <View style={[styles.selectButton, { backgroundColor: config.accent }]}>
                        <Text style={styles.selectButtonText}>
                          {isRecommended ? 'Start Now' : 'Choose Plan'}
                        </Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
            
            {/* Yearly savings note */}
            <View style={styles.savingsNote}>
              <Ionicons name="gift-outline" size={16} color={COLORS.cosmicGold} />
              <Text style={styles.savingsText}>
                Save 2 months with yearly billing
              </Text>
            </View>
            
            {/* Skip option */}
            <Pressable style={styles.skipButton} onPress={handleClose}>
              <Text style={styles.skipText}>Maybe later</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.92,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: COLORS.cosmicGold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  gradientBackground: {
    padding: 24,
    paddingTop: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  starDecor: {
    position: 'absolute',
  },
  star1: {
    top: 20,
    left: 30,
  },
  star2: {
    top: 60,
    right: 50,
  },
  star3: {
    top: 40,
    left: '45%',
  },
  starText: {
    fontSize: 20,
    color: COLORS.cosmicGold,
    opacity: 0.6,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.starWhite,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  headerMessage: {
    fontSize: 15,
    color: 'rgba(248, 248, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  tiersContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  tierCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tierCardRecommended: {
    borderColor: COLORS.cosmicGold,
    borderWidth: 2,
  },
  tierCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  tierCardGradient: {
    padding: 16,
    alignItems: 'center',
  },
  recommendedBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    alignItems: 'center',
  },
  recommendedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  tierHeader: {
    alignItems: 'center',
    marginTop: 16,
  },
  tierIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.starWhite,
    marginBottom: 4,
  },
  tierTagline: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tierPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 12,
  },
  tierPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.starWhite,
  },
  tierPeriod: {
    fontSize: 12,
    color: 'rgba(248, 248, 255, 0.6)',
    marginLeft: 4,
  },
  tierFeatures: {
    width: '100%',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 11,
    color: 'rgba(248, 248, 255, 0.85)',
    flex: 1,
  },
  moreFeatures: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  selectButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  savingsNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  savingsText: {
    fontSize: 13,
    color: COLORS.cosmicGold,
    fontWeight: '500',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(248, 248, 255, 0.5)',
  },
});

export default UpsellModal;















