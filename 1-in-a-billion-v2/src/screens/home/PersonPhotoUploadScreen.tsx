import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { useProfileStore } from '@/store/profileStore';
import { uploadPersonPhoto } from '@/services/personPhotoService';
import { useAuthStore } from '@/store/authStore';
import { insertPersonToSupabase } from '@/services/peopleService';

type Props = NativeStackScreenProps<MainStackParamList, 'PersonPhotoUpload'>;

let ImagePicker: any = null;
const loadImagePicker = async () => {
    if (!ImagePicker) {
        try {
            ImagePicker = await import('expo-image-picker');
        } catch {
            ImagePicker = null;
        }
    }
    return ImagePicker;
};

export const PersonPhotoUploadScreen = ({ navigation, route }: Props) => {
    const { personId, returnTo } = route.params;
    const people = useProfileStore((s) => s.people);
    const updatePerson = useProfileStore((s) => s.updatePerson);
    const authUser = useAuthStore((s) => s.user);
    const person = people.find((p) => p.id === personId);

    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const glowOpacity = useRef(new Animated.Value(0.35)).current;

    const handleDone = () => {
        if (returnTo === 'ComparePeople') {
            navigation.navigate('ComparePeople');
        } else if (returnTo === 'PeopleList') {
            navigation.navigate('PeopleList');
        } else {
            navigation.goBack();
        }
    };

    const hasPortrait = Boolean(person?.portraitUrl || person?.originalPhotoUrl || previewUri);
    const showPulse = isUploading || !hasPortrait;
    const displayUri = previewUri || person?.portraitUrl || person?.originalPhotoUrl || null;

    useEffect(() => {
        if (!showPulse) {
            glowOpacity.setValue(0.35);
            return;
        }

        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(glowOpacity, {
                    toValue: 1,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(glowOpacity, {
                    toValue: 0.35,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [glowOpacity, showPulse]);

    const personLabel = useMemo(() => person?.name || 'Person', [person?.name]);

    const runUpload = async (photoBase64: string, localUri: string) => {
        if (!person) return;

        setPreviewUri(localUri);
        setIsUploading(true);
        try {
            const result = await uploadPersonPhoto(person.id, photoBase64);
            if (!result.success || !result.portraitUrl) {
                throw new Error(result.error || 'Could not generate portrait');
            }

            updatePerson(person.id, {
                portraitUrl: result.portraitUrl,
                originalPhotoUrl: result.originalUrl || person.originalPhotoUrl,
            });
            if (authUser?.id) {
                const freshPerson = useProfileStore.getState().getPerson(person.id);
                if (freshPerson) {
                    await insertPersonToSupabase(authUser.id, freshPerson);
                }
            }
            setPreviewUri(null);
        } catch (error: any) {
            Alert.alert('Upload failed', error?.message || 'Could not upload photo.');
        } finally {
            setIsUploading(false);
        }
    };

    const pickPhoto = async () => {
        const picker = await loadImagePicker();
        if (!picker) {
            Alert.alert('Unavailable', 'Photo upload requires a native build with image picker support.');
            return;
        }

        const { status } = await picker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission required', 'Please allow photo library access.');
            return;
        }

        const result = await picker.launchImageLibraryAsync({
            mediaTypes: picker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        });

        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        if (!asset.base64 || !asset.uri) {
            Alert.alert('Upload failed', 'Could not read selected photo.');
            return;
        }
        await runUpload(asset.base64, asset.uri);
    };

    const onTapSquare = () => {
        if (isUploading) return;
        if (person?.portraitUrl) {
            Alert.alert(
                'Update portrait?',
                'Choose a new photo to regenerate this stylized portrait.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Regenerate', style: 'destructive', onPress: () => { void pickPhoto(); } },
                ]
            );
            return;
        }
        void pickPhoto();
    };

    if (!person) {
        return (
            <SafeAreaView style={styles.container}>
                <BackButton onPress={() => navigation.goBack()} />
                <View style={styles.topSpacer} />
                <View style={styles.centerState}>
                    <Text style={styles.title}>Person Not Found</Text>
                    <Text style={styles.subtitle}>This profile no longer exists.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={returnTo ? handleDone : () => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <View style={styles.content}>
                <Text style={styles.title}>Upload Portrait</Text>
                <Text style={styles.subtitle}>{personLabel}</Text>

                <TouchableOpacity style={styles.square} onPress={onTapSquare} disabled={isUploading} activeOpacity={0.85}>
                    {displayUri ? (
                        <Image source={{ uri: displayUri }} style={styles.image} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.placeholderInitial}>{personLabel.charAt(0).toUpperCase()}</Text>
                            <Text style={styles.placeholderHint}>Tap inside the square</Text>
                        </View>
                    )}

                    {showPulse ? <Animated.View pointerEvents="none" style={[styles.pulseBorder, { opacity: glowOpacity }]} /> : null}
                </TouchableOpacity>

                <View style={styles.noteCard}>
                    <Text style={styles.noteText}>
                        Your photo is transformed into a stylized portrait for visual consistency and privacy.
                    </Text>
                </View>

                {isUploading ? (
                    <View style={styles.uploading}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.uploadingText}>Transforming portrait...</Text>
                    </View>
                ) : null}

                {returnTo && !isUploading ? (
                    <TouchableOpacity style={styles.skipButton} onPress={handleDone} activeOpacity={0.7}>
                        <Text style={styles.skipText}>{hasPortrait ? 'Done' : 'Skip for now'}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </SafeAreaView>
    );
};

const SQUARE_SIZE = 304;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    topSpacer: {
        height: 72,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: spacing.page,
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.page,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
    },
    subtitle: {
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
        textAlign: 'center',
    },
    square: {
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        borderRadius: radii.card,
        overflow: 'hidden',
        marginBottom: spacing.md,
        position: 'relative',
        backgroundColor: colors.surface,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        width: '100%',
        height: '100%',
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
        borderRadius: radii.card,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
    },
    placeholderInitial: {
        fontFamily: typography.headline,
        fontSize: 82,
        color: colors.mutedText,
    },
    placeholderHint: {
        marginTop: spacing.sm,
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    pulseBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderWidth: 3,
        borderStyle: 'dotted',
        borderColor: colors.primary,
        borderRadius: radii.card,
    },
    noteCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        padding: spacing.md,
    },
    noteText: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        lineHeight: 18,
        color: colors.mutedText,
        textAlign: 'center',
    },
    uploading: {
        marginTop: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    uploadingText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 13,
        color: colors.text,
    },
    skipButton: {
        marginTop: spacing.lg,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xl,
    },
    skipText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 15,
        color: colors.mutedText,
        textAlign: 'center',
    },
});
