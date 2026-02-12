import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, TextInput, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { colors, spacing, typography, radii } from '@/theme/tokens';

type Props = NativeStackScreenProps<MainStackParamList, 'RelationshipContext'>;

const MAX_CHARS_DEFAULT = 100;
const MAX_CHARS_KABBALAH = 600;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH * 0.72, SCREEN_HEIGHT * 0.36);

export const RelationshipContextScreen = ({ navigation, route }: Props) => {
    const { partnerName = 'this person', productType, systems = [], ...restParams } = (route.params || {}) as any;
    const [context, setContext] = useState('');

    const isKabbalahActive = useMemo(
        () => Array.isArray(systems) && systems.includes('kabbalah'),
        [systems]
    );

    const maxChars = isKabbalahActive ? MAX_CHARS_KABBALAH : MAX_CHARS_DEFAULT;

    const continueFlow = (relationshipContext?: string) => {
        if (productType && Array.isArray(systems) && systems.length > 0) {
            navigation.navigate('VoiceSelection', {
                ...restParams,
                productType,
                systems,
                readingType: 'overlay',
                relationshipContext,
            } as any);
            return;
        }

        navigation.navigate('SystemSelection', {
            ...restParams,
            relationshipContext,
        } as any);
    };

    const handleSkip = () => continueFlow(undefined);

    const handleContinue = () => {
        const trimmed = context.trim();
        continueFlow(trimmed.length > 0 ? trimmed : undefined);
    };

    const headline = isKabbalahActive
        ? 'Impactful Life Events'
        : 'Would you like to tell us more about this soul connection?';

    const subline = isKabbalahActive
        ? 'Please include your real first name and surname. Key moments, exact dates, and places make this compatibility reading much stronger.'
        : `Share how you are connected to ${partnerName}, and what matters most to you in this connection.`;

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.topSpacer} />

                <View style={styles.content}>
                    <Text style={styles.title}>{headline}</Text>
                    <Text style={[styles.subtitle, isKabbalahActive && styles.subtitleKabbalah]}>{subline}</Text>

                    <View style={styles.circleArea}>
                        <View style={[styles.outerRing, styles.outerRingOne]} />
                        <View style={[styles.outerRing, styles.outerRingTwo]} />
                        <View style={styles.circleInputShell}>
                            <TextInput
                                value={context}
                                onChangeText={setContext}
                                multiline
                                maxLength={maxChars}
                                placeholder={
                                    isKabbalahActive
                                        ? 'Example: My mother died on 07 June 2003 in Munich during childbirth.'
                                        : 'I will speak the truth'
                                }
                                placeholderTextColor={colors.mutedText}
                                style={[styles.input, isKabbalahActive && styles.inputKabbalah]}
                                textAlignVertical="top"
                            />
                            <Text style={styles.counter}>{context.length}/{maxChars}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actions}>
                    <Button
                        label="Skip"
                        variant="secondary"
                        onPress={handleSkip}
                        style={styles.actionButton}
                    />
                    <Button
                        label="Continue"
                        onPress={handleContinue}
                        style={styles.actionButton}
                    />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    keyboardView: {
        flex: 1,
    },
    topSpacer: {
        height: 74,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.page,
        alignItems: 'center',
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 30,
        lineHeight: 38,
        color: colors.text,
        textAlign: 'center',
    },
    subtitle: {
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
        fontFamily: typography.sansRegular,
        fontSize: 15,
        lineHeight: 22,
        color: colors.mutedText,
        textAlign: 'center',
    },
    subtitleKabbalah: {
        fontSize: 14,
    },
    circleArea: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    outerRing: {
        position: 'absolute',
        borderWidth: 1,
        borderColor: 'rgba(209, 0, 0, 0.25)',
        borderRadius: 999,
    },
    outerRingOne: {
        width: CIRCLE_SIZE * 1.1,
        height: CIRCLE_SIZE * 1.1,
    },
    outerRingTwo: {
        width: CIRCLE_SIZE * 1.22,
        height: CIRCLE_SIZE * 1.22,
        borderColor: 'rgba(209, 0, 0, 0.14)',
    },
    circleInputShell: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.text,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    input: {
        flex: 1,
        fontFamily: typography.sansRegular,
        fontSize: 16,
        lineHeight: 22,
        color: colors.text,
    },
    inputKabbalah: {
        fontSize: 13,
        lineHeight: 19,
    },
    counter: {
        marginTop: spacing.xs,
        alignSelf: 'flex-end',
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.lg,
    },
    actionButton: {
        flex: 1,
        borderRadius: radii.button,
    },
});
