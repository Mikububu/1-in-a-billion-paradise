import { NavigationProp } from '@react-navigation/native';
import type { CityOption } from '@/types/forms';
import { MainStackParamList } from '@/navigation/RootNavigator';

export type ReadingType = 'individual' | 'overlay';
export type ReadingProduct = 'single_system' | 'bundle_5_readings' | 'bundle_16_readings' | 'compatibility_overlay';

type PersonOverride = {
    id?: string;
    name: string;
    birthDate: string;
    birthTime: string;
    timezone: string;
    latitude: number;
    longitude: number;
    placements?: any;
};

type PurchaseFlowParams = {
    navigation: NavigationProp<MainStackParamList>;
    productType: ReadingProduct;
    readingType: ReadingType;
    systems: string[];
    personName?: string;
    userName?: string;
    partnerName?: string;
    partnerBirthDate?: string;
    partnerBirthTime?: string | null;
    partnerBirthCity?: CityOption | null;
    person1Override?: PersonOverride;
    person2Override?: PersonOverride;
    personId?: string;
    partnerId?: string;
    targetPersonName?: string;
    forPartner?: boolean;
};

export function initiatePurchaseFlow(params: PurchaseFlowParams) {
    const {
        navigation,
        productType,
        readingType,
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
        targetPersonName,
        forPartner,
    } = params;

    const isOverlay = readingType === 'overlay';

    if (isOverlay && (partnerName || person2Override)) {
        navigation.navigate('RelationshipContext', {
            readingType: 'overlay',
            forPartner,
            userName,
            partnerName,
            partnerBirthDate,
            partnerBirthTime,
            partnerBirthCity,
            person1Override,
            person2Override,
            personId,
            partnerId,
            productType,
            systems,
        } as any);
        return;
    }

    navigation.navigate('PersonalContext', {
        personName: personName || targetPersonName || userName || 'You',
        readingType: 'individual',
        forPartner,
        userName,
        personBirthDate: forPartner ? partnerBirthDate : undefined,
        personBirthTime: forPartner ? partnerBirthTime : undefined,
        personBirthCity: forPartner ? partnerBirthCity : undefined,
        partnerName,
        partnerBirthDate,
        partnerBirthTime,
        partnerBirthCity,
        person1Override,
        person2Override,
        personId,
        partnerId,
        targetPersonName,
        productType,
        systems,
    } as any);
}
