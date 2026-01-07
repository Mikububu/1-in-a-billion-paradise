import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';

type Props = NativeStackScreenProps<MainStackParamList, 'HowMatchingWorks'>;

export const HowMatchingWorksScreen = ({ navigation }: Props) => {
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.headline}>How Matching Works</Text>

                <View style={styles.card}>
                    <Text style={styles.text}>
                        Our matching system calculates compatibility across multiple spiritual systems including Astrology, Numerology, and Human Design.
                    </Text>
                    <Text style={styles.text}>
                        When you see a match count, it represents people who have a high algorithmic resonance with your unique signature.
                    </Text>
                    <Text style={styles.text}>
                        [Detailed explanation to be finalized]
                    </Text>
                </View>

                <View style={styles.buttonContainer}>
                    <Button
                        label="GOT IT"
                        onPress={() => navigation.goBack()}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.page,
        alignItems: 'center',
        paddingTop: spacing.xl,
    },
    headline: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xl,
        fontStyle: 'italic',
    },
    card: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: 20,
        width: '100%',
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.md,
    },
    text: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        lineHeight: 24,
    },
    buttonContainer: {
        marginTop: spacing.xl * 2,
        width: '100%',
    },
});
