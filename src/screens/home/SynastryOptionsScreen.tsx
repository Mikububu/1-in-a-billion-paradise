import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';
import { colors, spacing, typography, radii } from '@/theme/tokens';

type Props = NativeStackScreenProps<MainStackParamList, 'SynastryOptions'>;

export const SynastryOptionsScreen = ({ navigation, route }: Props) => {
    const {
        partnerName = 'Partner',
        partnerBirthDate,
        partnerBirthTime,
        partnerBirthCity,
    } = route.params || {};

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Choose Your Deep Reading</Text>
                <Text style={styles.subtitle}>
                    Continue with yourself, {partnerName}, or your compatibility overlay.
                </Text>

                <TouchableOpacity
                    style={styles.option}
                    onPress={() =>
                        navigation.navigate('PersonalContext', {
                            personName: 'You',
                            readingType: 'self',
                            forPartner: false,
                            userName: 'You',
                        })
                    }
                >
                    <Text style={styles.optionTitle}>Your Reading</Text>
                    <Text style={styles.optionMeta}>5-system deep reading for your own chart.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.option}
                    onPress={() =>
                        navigation.navigate('PersonalContext', {
                            personName: partnerName,
                            readingType: 'other',
                            forPartner: true,
                            userName: partnerName,
                            partnerName,
                            personBirthDate: partnerBirthDate,
                            personBirthTime: partnerBirthTime,
                            personBirthCity: partnerBirthCity,
                        })
                    }
                >
                    <Text style={styles.optionTitle}>{partnerName}'s Reading</Text>
                    <Text style={styles.optionMeta}>5-system deep reading for {partnerName}.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.option}
                    onPress={() =>
                        navigation.navigate('RelationshipContext', {
                            readingType: 'overlay',
                            forPartner: false,
                            userName: 'You',
                            partnerName,
                            partnerBirthDate,
                            partnerBirthTime,
                            partnerBirthCity,
                        })
                    }
                >
                    <Text style={styles.optionTitle}>Overlay Reading</Text>
                    <Text style={styles.optionMeta}>Compatibility and relational dynamics.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.addPerson}
                    onPress={() => navigation.navigate('PartnerInfo', { mode: 'add_person_only' })}
                >
                    <Text style={styles.addPersonText}>Add Another Person</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    topSpacer: {
        height: 72,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.xl,
    },
    title: {
        textAlign: 'center',
        fontFamily: typography.headline,
        fontSize: 34,
        color: colors.text,
    },
    subtitle: {
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
    },
    option: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    optionTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 18,
        color: colors.text,
    },
    optionMeta: {
        marginTop: 4,
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
    },
    addPerson: {
        marginTop: spacing.sm,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.primary,
        borderRadius: radii.button,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    addPersonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.primary,
    },
});
