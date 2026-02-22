/**
 * CONTACT SUPPORT SCREEN
 */

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ContactSupport'>;

const SUPPORT_EMAIL = 'contact@1-in-a-billion.app';

export const ContactSupportScreen = ({ navigation }: Props) => {
    const handleEmailSupport = () => {
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Support Request`).catch(() => {
            Alert.alert('Error', 'Could not open mail app.');
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Support</Text>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Need help?</Text>
                    <Text style={styles.cardText}>
                        Our team is here to assist you with any questions or issues you may have while exploring the laboratory.
                    </Text>

                    <TouchableOpacity style={styles.button} onPress={handleEmailSupport}>
                        <Text style={styles.buttonText}>Email Support</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.faqSection}>
                    <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

                    <View style={styles.faqItem}>
                        <Text style={styles.faqQuestion}>How long does a reading take?</Text>
                        <Text style={styles.faqAnswer}>
                            Most readings are generated within 30-60 seconds. Complete readings may take slightly longer.
                        </Text>
                    </View>

                    <View style={styles.faqItem}>
                        <Text style={styles.faqQuestion}>Can I access my readings offline?</Text>
                        <Text style={styles.faqAnswer}>
                            Yes, once a reading is generated, it is saved to your device for offline access in My Library.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.page,
        paddingVertical: spacing.xl,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        marginBottom: spacing.xl,
    },
    card: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xl,
    },
    cardTitle: {
        fontFamily: typography.serifBold,
        fontSize: 22,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    cardText: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        lineHeight: 24,
        marginBottom: spacing.lg,
    },
    button: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: radii.button,
        alignItems: 'center',
    },
    buttonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: '#fff',
    },
    faqSection: {
        marginTop: spacing.lg,
    },
    sectionTitle: {
        fontFamily: typography.serifBold,
        fontSize: 20,
        color: colors.text,
        marginBottom: spacing.lg,
    },
    faqItem: {
        marginBottom: spacing.lg,
    },
    faqQuestion: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
        marginBottom: 4,
    },
    faqAnswer: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        lineHeight: 20,
    },
});
