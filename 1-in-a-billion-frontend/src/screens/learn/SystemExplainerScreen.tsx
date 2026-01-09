/**
 * SYSTEM EXPLAINER SCREEN
 * 
 * Educates users about each astrological/spiritual system before purchase.
 * Split into 2 swipeable pages for better readability.
 */

import { useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { SINGLE_SYSTEM, SYSTEM_PRICES, PRODUCT_STRINGS } from '@/config/products';

type Props = NativeStackScreenProps<MainStackParamList, 'SystemExplainer'>;

export type SystemType = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Content for each system - warm, intimate, friendly tone
const SYSTEM_CONTENT: Record<SystemType, {
  name: string;
  tagline: string;
  origin: string;
  intro: string;
  howItHelpsYou: string;
  whatYouDiscover: string[];
  personalNote: string;
  icon: string;
}> = {
  western: {
    name: 'Western Astrology',
    tagline: 'The poetry of who you are',
    origin: 'Ancient Greece & Babylon',
    icon: '☉',
    intro: `You know your Sun sign, but that's just the beginning of your story. The moment you were born, the entire sky arranged itself into a pattern that has never existed before and never will again. That pattern is you.`,
    howItHelpsYou: `Think of your birth chart as a love letter from the universe, written in the language of planets and stars. It shows not just who you are, but why you love the way you love, what secretly scares you, and what makes your heart come alive.`,
    whatYouDiscover: [
      'Why you feel things so deeply (or why you don\'t)',
      'The hidden patterns in your relationships',
      'What you actually need vs what you think you want',
      'Your unique gifts - the ones you probably undervalue',
    ],
    personalNote: `"Sweetheart, with your Venus in the 8th house, you've probably been told you're 'too intense.' But here's the truth: you're not too much. You're designed for the kind of love most people are too afraid to ask for."`,
  },
  
  vedic: {
    name: 'Jyotish (Vedic)',
    tagline: 'Where your soul has been, where it\'s going',
    origin: '5,000 years of Indian wisdom',
    icon: 'ॐ',
    intro: `While Western astrology asks "who are you?", Vedic astrology asks "where are you in your journey?" It's older, more precise, and deeply concerned with timing. It sees your life as a story unfolding in chapters.`,
    howItHelpsYou: `Vedic astrology doesn't just describe you - it shows you when. When will the struggle ease? When should you make that move? When will love find you? Understanding which chapter you're in changes everything.`,
    whatYouDiscover: [
      'Which life chapter you\'re in right now',
      'Why certain years felt harder than others',
      'The karma you came here to work through',
      'Timing for big decisions and relationships',
    ],
    personalNote: `"Darling, you've been in a Saturn period, and I know it's felt relentless. But Saturn isn't punishing you - Saturn is preparing you. Whatever you're building right now, it's creating something that will last."`,
  },
  
  human_design: {
    name: 'Human Design',
    tagline: 'Permission to be yourself',
    origin: 'A synthesis of ancient wisdom',
    icon: '◬',
    intro: `What if the way you've been trying to live your life simply isn't designed for you? Human Design reveals your energetic blueprint - how you're actually meant to make decisions, use your energy, and interact with others.`,
    howItHelpsYou: `Most of us were taught to be something we're not. Push harder. Initiate more. Say yes to everything. But you have a specific design, and when you live according to it, life gets easier. The right people find you.`,
    whatYouDiscover: [
      'Your Type - how you\'re designed to engage with life',
      'Your Strategy - the one rule that changes everything',
      'Your Authority - how YOUR body makes decisions',
      'Why certain environments drain you',
    ],
    personalNote: `"Beautiful soul, you're a Projector, which means you were never supposed to hustle like everyone else. Your gift is seeing what others miss. But you have to wait to be invited. The right recognition will find you."`,
  },
  
  gene_keys: {
    name: 'Gene Keys',
    tagline: 'Your shadows hold your gifts',
    origin: 'Ancient wisdom meets modern genetics',
    icon: '❋',
    intro: `Here's something beautiful: your deepest wounds and your greatest gifts are the same thing, just at different frequencies. Gene Keys shows you the spectrum you're walking - from shadow to gift to something transcendent.`,
    howItHelpsYou: `Gene Keys is less about information and more about transformation. You contemplate your keys, and slowly, gently, the patterns shift. The thing you've been ashamed of? It's actually your superpower in disguise.`,
    whatYouDiscover: [
      'The shadow pattern that keeps tripping you up',
      'The gift hidden inside that shadow',
      'Your Venus Sequence - how you open to love',
      'The highest version of what you can become',
    ],
    personalNote: `"Precious one, your Gene Key 36 shadow is Crisis - you create drama unconsciously because stillness feels dangerous. But your gift is Humanity - you feel everything, and that feeling is how you connect the world."`,
  },
  
  kabbalah: {
    name: 'Kabbalah',
    tagline: 'The repair only you can make',
    origin: 'Jewish mystical tradition',
    icon: '✧',
    intro: `Kabbalah teaches that your soul chose this life for a reason. You came here with a specific Tikkun - a repair, a correction, a piece of the cosmic puzzle that only you can complete.`,
    howItHelpsYou: `The Tree of Life maps consciousness itself - and your place on it. Where do you tend to get stuck? What's the lesson that keeps returning? What are you here to transform, not just for yourself, but for everyone?`,
    whatYouDiscover: [
      'Your Tikkun - the soul correction you chose',
      'Which Sephirah dominates your spiritual work',
      'The blocks (Klipot) hiding your light',
      'Practices to accelerate your transformation',
    ],
    personalNote: `"Dear heart, your Tikkun is in Hod - the sphere of the mind. You overthink because you're trying to feel safe through understanding. Your correction isn't to think less - it's to let your brilliant mind serve your heart."`,
  },
};

// Prices imported from @/config/products - SYSTEM_PRICES

export const SystemExplainerScreen = ({ navigation, route }: Props) => {
  const { 
    system = 'western', 
    forPurchase = true,
    readingType = 'individual',
    forPartner,
    partnerName,
    partnerBirthDate,
    partnerBirthTime,
    partnerBirthCity,
    userName,
    person1Override,
    person2Override,
  } = route.params || {};
  const content = SYSTEM_CONTENT[system] || SYSTEM_CONTENT.western;
  const price = SYSTEM_PRICES[system] || SINGLE_SYSTEM.price;
  
  const [currentPage, setCurrentPage] = useState(0);
  const listRef = useRef<FlatList>(null);

  const handleGetReading = () => {
    // Route through injection screens (PersonalContext or RelationshipContext)
    if (readingType === 'overlay' && partnerName) {
      // Overlay reading → RelationshipContext
      navigation.navigate('RelationshipContext', {
        readingType: 'overlay',
        forPartner: false,
        userName: userName || 'You',
        partnerName,
        partnerBirthDate,
        partnerBirthTime,
        partnerBirthCity,
        preselectedSystem: system,
        person1Override,
        person2Override,
      } as any);
    } else {
      // Individual reading → PersonalContext
      navigation.navigate('PersonalContext', {
        personName: (forPartner && partnerName) ? partnerName : 'You',
        readingType: forPartner ? 'other' : 'self',
        personBirthDate: forPartner ? partnerBirthDate : undefined,
        personBirthTime: forPartner ? partnerBirthTime : undefined,
        personBirthCity: forPartner ? partnerBirthCity : undefined,
        preselectedSystem: system,
      });
    }
  };

  const pages = [
    // Page 1: Intro, How it helps & Personal note
    <View key="page1" style={styles.page}>
      <Text style={styles.icon}>{content.icon}</Text>
      <Text style={styles.title} selectable>{content.name}</Text>
      <Text style={styles.tagline} selectable>{content.tagline}</Text>
      <Text style={styles.origin} selectable>{content.origin}</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionText} selectable>{content.intro}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How it helps you</Text>
        <Text style={styles.sectionText} selectable>{content.howItHelpsYou}</Text>
      </View>
      
      <View style={styles.insightBox}>
        <Text style={styles.insightLabel}>A note for you</Text>
        <Text style={styles.insightText} selectable>{content.personalNote}</Text>
      </View>
    </View>,
    
    // Page 2: What you discover & CTA
    <View key="page2" style={styles.page}>
      <View style={styles.discoverSection}>
        <Text style={styles.discoverTitle}>What You'll Discover</Text>
        {content.whatYouDiscover.map((item, idx) => {
          const symbols = ['☉', '☽', '✧', '◎'];
          return (
            <View key={idx} style={styles.discoverItem}>
              <Text style={styles.discoverSymbol}>{symbols[idx % symbols.length]}</Text>
              <Text style={styles.discoverText} selectable>{item}</Text>
            </View>
          );
        })}
      </View>
      
      {/* CTA - Big button with details */}
      <TouchableOpacity style={styles.bigCta} onPress={handleGetReading} activeOpacity={0.8}>
        <Text style={styles.bigCtaTitle}>Get {content.name}</Text>
        <Text style={styles.bigCtaDetails}>{PRODUCT_STRINGS.singleSystem.summary}</Text>
        <Text style={styles.bigCtaPrice}>${price}</Text>
      </TouchableOpacity>
      <Text style={styles.devNote}>DEV: Skips payment</Text>
    </View>,
  ];

  const handleScroll = (event: any) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const pageIndex = Math.round(contentOffset.x / layoutMeasurement.width);
    setCurrentPage(pageIndex);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      {/* Swipeable Pages */}
      <FlatList
        ref={listRef}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => item}
        keyExtractor={(_, index) => `page-${index}`}
      />

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {pages.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.dot, currentPage === index && styles.dotActive]}
            onPress={() => {
              listRef.current?.scrollToIndex({ index, animated: true });
              setCurrentPage(index);
            }}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: spacing.page,
    zIndex: 10,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  
  // Page
  page: {
    width: SCREEN_WIDTH,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
  },
  
  // Header content
  icon: { 
    fontSize: 48, 
    textAlign: 'center', 
    marginBottom: spacing.sm,
  },
  title: { 
    fontFamily: typography.headline, 
    fontSize: 28, 
    color: colors.text, 
    textAlign: 'center',
  },
  tagline: { 
    fontFamily: typography.sansRegular, 
    fontSize: 16, 
    color: colors.primary, 
    textAlign: 'center', 
    marginTop: spacing.xs, 
    fontStyle: 'italic',
  },
  origin: { 
    fontFamily: typography.sansRegular, 
    fontSize: 13, 
    color: colors.mutedText, 
    textAlign: 'center', 
    marginTop: spacing.xs, 
    marginBottom: spacing.lg,
  },
  
  // Sections
  section: { 
    marginBottom: spacing.lg,
  },
  sectionTitle: { 
    fontFamily: typography.sansSemiBold, 
    fontSize: 12, 
    color: colors.primary, 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    marginBottom: spacing.sm,
  },
  sectionText: { 
    fontFamily: typography.sansRegular, 
    fontSize: 15, 
    color: colors.text, 
    lineHeight: 23,
  },
  
  // What you'll discover - centered with symbols
  discoverSection: {
    marginTop: spacing.xl * 2,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  discoverTitle: {
    fontFamily: typography.headline,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
    letterSpacing: 0.5,
  },
  discoverItem: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  discoverSymbol: {
    fontSize: 24,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  discoverText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  
  // Insight box
  insightBox: { 
    backgroundColor: colors.surface, 
    padding: spacing.md, 
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  insightLabel: { 
    fontFamily: typography.sansSemiBold, 
    fontSize: 11, 
    color: colors.primary, 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    marginBottom: spacing.sm,
  },
  insightText: { 
    fontFamily: typography.sansRegular, 
    fontSize: 14, 
    color: colors.text, 
    lineHeight: 22, 
    fontStyle: 'italic',
  },
  
  // Big CTA button
  bigCta: {
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  bigCtaTitle: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: colors.background,
    marginBottom: spacing.xs,
  },
  bigCtaDetails: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.background,
    opacity: 0.9,
    marginBottom: spacing.sm,
  },
  bigCtaPrice: {
    fontFamily: typography.sansBold,
    fontSize: 24,
    color: colors.background,
  },
  devNote: { 
    fontFamily: typography.sansRegular, 
    fontSize: 11, 
    color: colors.mutedText, 
    textAlign: 'center', 
    marginTop: spacing.xs,
  },
  
  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.divider,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
});
