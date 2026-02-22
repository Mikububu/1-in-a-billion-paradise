/**
 * DATA PRIVACY SCREEN
 */

import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'DataPrivacy'>;

export const DataPrivacyScreen = ({ navigation }: Props) => {
    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>AI & Data Usage</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionContent}>
                        1 In A Billion uses advanced artificial intelligence to generate your personalized astrological readings and compatibility reports.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>What data do we share with AI?</Text>
                    <Text style={styles.sectionContent}>
                        We share birth data (date, time, location) and calculated planetary positions with our AI providers. We do NOT share your name, email, or any identifying information.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Privacy First</Text>
                    <Text style={styles.sectionContent}>
                        Your privacy is our priority. All AI processing is done securely, and we do not use your data to train public models.
                    </Text>
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
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontFamily: typography.serifBold,
        fontSize: 20,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    sectionContent: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.text,
        lineHeight: 24,
    },
});
