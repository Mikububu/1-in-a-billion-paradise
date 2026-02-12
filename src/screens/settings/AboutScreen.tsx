/**
 * ABOUT SCREEN
 */

import { StyleSheet, Text, View, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'About'>;

export const AboutScreen = ({ navigation }: Props) => {
    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>About</Text>

                <View style={styles.content}>
                    <Text style={styles.description}>
                        1 In A Billion is a spiritual laboratory designed to help you explore the deep patterns of your soul.
                    </Text>

                    <Text style={styles.sectionTitle}>Our Mission</Text>
                    <Text style={styles.description}>
                        We combine ancient wisdom with modern technology to provide profound insights into your personality, relationships, and life path.
                    </Text>

                    <Text style={styles.sectionTitle}>The Technology</Text>
                    <Text style={styles.description}>
                        Our system uses precise astronomical data from the Swiss Ephemeris and advanced AI to interpret complex astrological placements across multiple systems: Western Astrology, Vedic Astrology, Human Design, Gene Keys, and Kabbalah.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.version}>Version 2.0.0</Text>
                    <Text style={styles.copyright}>© 2024 One In A Billion Ltd.</Text>
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
    content: {
        marginBottom: spacing.xxl,
    },
    sectionTitle: {
        fontFamily: typography.serifBold,
        fontSize: 20,
        color: colors.text,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    description: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        lineHeight: 24,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    version: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
    },
    copyright: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        marginTop: spacing.xs,
    },
});
