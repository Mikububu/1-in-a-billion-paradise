/**
 * SUBSCRIPTION CONFIGURATION
 * 
 * The "1 in a Billion" subscription tiers for tracking multiple people
 * and unlocking deeper readings.
 * 
 * BUSINESS LOGIC:
 * - Free tier: User's own Sun/Moon/Rising only
 * - Basic: Add people, basic comparisons
 * - Pro: Unlimited deep readings
 * - Cosmic: Unlimited everything + relationship mapping
 */

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'cosmic';

export type SubscriptionProduct = {
    id: string;
    tier: SubscriptionTier;
    name: string;
    tagline: string;
    priceMonthly: number;
    priceYearly: number; // 2 months free on yearly
    features: string[];
    limits: {
        maxPeople: number; // -1 = unlimited
        deepReadingsPerMonth: number; // -1 = unlimited
        synastryPerMonth: number; // -1 = unlimited
        audioEnabled: boolean;
        pdfEnabled: boolean;
        priorityQueue: boolean;
    };
    appleProductId: string;
    googleProductId: string;
};

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, SubscriptionProduct> = {
    free: {
        id: 'free',
        tier: 'free',
        name: 'Free',
        tagline: 'Discover yourself',
        priceMonthly: 0,
        priceYearly: 0,
        features: [
            'Your Sun, Moon, Rising readings',
            'Audio narration for your readings',
            'Store your birth chart',
        ],
        limits: {
            maxPeople: 0, // Cannot add other people
            deepReadingsPerMonth: 0,
            synastryPerMonth: 0,
            audioEnabled: true,
            pdfEnabled: false,
            priorityQueue: false,
        },
        appleProductId: '',
        googleProductId: '',
    },

    basic: {
        id: 'basic_monthly',
        tier: 'basic',
        name: 'Explorer',
        tagline: 'Understand your connections',
        priceMonthly: 9.99,
        priceYearly: 99.99, // ~$8.33/month
        features: [
            'Everything in Free',
            'Add unlimited people',
            'Sun/Moon/Rising for each person',
            'Basic compatibility scores',
            'Audio for all readings',
            'Reading library storage',
        ],
        limits: {
            maxPeople: -1, // Unlimited
            deepReadingsPerMonth: 0, // No deep readings
            synastryPerMonth: 3, // 3 basic comparisons
            audioEnabled: true,
            pdfEnabled: false,
            priorityQueue: false,
        },
        appleProductId: 'com.1inabillion.basic.monthly',
        googleProductId: 'basic_monthly',
    },

    pro: {
        id: 'pro_monthly',
        tier: 'pro',
        name: 'Seeker',
        tagline: 'Deep cosmic knowledge',
        priceMonthly: 19.99,
        priceYearly: 199.99, // ~$16.67/month
        features: [
            'Everything in Explorer',
            'Unlimited deep readings (all 5 systems)',
            'Full synastry compatibility',
            'Priority audio generation',
            'PDF downloads',
            'Relationship insights',
        ],
        limits: {
            maxPeople: -1,
            deepReadingsPerMonth: -1, // Unlimited
            synastryPerMonth: -1, // Unlimited
            audioEnabled: true,
            pdfEnabled: true,
            priorityQueue: true,
        },
        appleProductId: 'com.1inabillion.pro.monthly',
        googleProductId: 'pro_monthly',
    },

    cosmic: {
        id: 'cosmic_monthly',
        tier: 'cosmic',
        name: 'Cosmic Circle',
        tagline: 'Master of connections',
        priceMonthly: 29.99,
        priceYearly: 299.99, // ~$25/month
        features: [
            'Everything in Seeker',
            'Track up to 50 people',
            'Relationship mapping (visualize your circle)',
            'Group compatibility analysis',
            'Cosmic calendar (best days for each person)',
            'Early access to new features',
        ],
        limits: {
            maxPeople: 50,
            deepReadingsPerMonth: -1,
            synastryPerMonth: -1,
            audioEnabled: true,
            pdfEnabled: true,
            priorityQueue: true,
        },
        appleProductId: 'com.1inabillion.cosmic.monthly',
        googleProductId: 'cosmic_monthly',
    },
};

// Helper functions
export function getTierByProductId(productId: string): SubscriptionTier {
    for (const [tier, product] of Object.entries(SUBSCRIPTION_TIERS)) {
        if (product.appleProductId === productId || product.googleProductId === productId) {
            return tier as SubscriptionTier;
        }
    }
    return 'free';
}

export function canAddPerson(tier: SubscriptionTier, currentPeopleCount: number): boolean {
    const limits = SUBSCRIPTION_TIERS[tier].limits;
    if (limits.maxPeople === -1) return true;
    return currentPeopleCount < limits.maxPeople;
}

export function canGenerateDeepReading(tier: SubscriptionTier, monthlyCount: number): boolean {
    const limits = SUBSCRIPTION_TIERS[tier].limits;
    if (limits.deepReadingsPerMonth === -1) return true;
    return monthlyCount < limits.deepReadingsPerMonth;
}

export function canGenerateSynastry(tier: SubscriptionTier, monthlyCount: number): boolean {
    const limits = SUBSCRIPTION_TIERS[tier].limits;
    if (limits.synastryPerMonth === -1) return true;
    return monthlyCount < limits.synastryPerMonth;
}

// Upsell trigger points
export type UpsellTrigger =
    | 'add_first_person'        // When they try to add someone
    | 'add_person_limit'        // When they hit person limit
    | 'deep_reading_limit'      // When they want a deep reading
    | 'synastry_limit'          // When they want synastry
    | 'pdf_download'            // When they want PDF
    | 'after_hook_sequence'     // After seeing their free readings
    | 'partner_deep_reading';   // After adding a partner's basic readings

export const UPSELL_MESSAGES: Record<UpsellTrigger, { title: string; message: string; suggestedTier: SubscriptionTier }> = {
    add_first_person: {
        title: 'Unlock Your Circle',
        message: 'Want to understand the people in your life? Upgrade to Explorer to add partners, friends, and family.',
        suggestedTier: 'basic',
    },
    add_person_limit: {
        title: 'Expand Your Cosmic Circle',
        message: 'You\'ve reached your person limit. Upgrade to track more connections.',
        suggestedTier: 'cosmic',
    },
    deep_reading_limit: {
        title: 'Go Deeper',
        message: 'Unlock unlimited deep readings across all 5 cosmic systems with Seeker.',
        suggestedTier: 'pro',
    },
    synastry_limit: {
        title: 'Unlimited Compatibility',
        message: 'Want to compare everyone in your life? Upgrade for unlimited synastry readings.',
        suggestedTier: 'pro',
    },
    pdf_download: {
        title: 'Keep Your Readings',
        message: 'Download beautiful PDFs of your readings. Available with Seeker or higher.',
        suggestedTier: 'pro',
    },
    after_hook_sequence: {
        title: 'You\'ve Just Scratched the Surface',
        message: 'Your Sun, Moon, and Rising are just the beginning. Discover all 5 cosmic systems and track the people who matter to you.',
        suggestedTier: 'basic',
    },
    partner_deep_reading: {
        title: 'Understand Them Deeper',
        message: 'You\'ve seen the basics. Now discover their full cosmic blueprint with deep readings.',
        suggestedTier: 'pro',
    },
};

// Subscription state type for the store
export type SubscriptionState = {
    tier: SubscriptionTier;
    isActive: boolean;
    expiresAt: string | null;
    productId: string | null;
    purchaseDate: string | null;
    monthlyDeepReadings: number;
    monthlySynastry: number;
    monthResetDate: string;
};

export const DEFAULT_SUBSCRIPTION_STATE: SubscriptionState = {
    tier: 'free',
    isActive: false,
    expiresAt: null,
    productId: null,
    purchaseDate: null,
    monthlyDeepReadings: 0,
    monthlySynastry: 0,
    monthResetDate: new Date().toISOString(),
};
