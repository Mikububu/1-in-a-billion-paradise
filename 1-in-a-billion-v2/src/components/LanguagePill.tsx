import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import { LANGUAGE_META, getLanguage, onLanguageChange, type LanguageCode } from '@/i18n';

interface Props {
    onPress: () => void;
    style?: object;
}

export const LanguagePill = ({ onPress, style }: Props) => {
    const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(getLanguage());
    const [displayLangIndex, setDisplayLangIndex] = useState(0);

    const langFadeAnim = useRef(new Animated.Value(1)).current;
    const langBorderAnim = useRef(new Animated.Value(0)).current;

    // Automatically pull native names for all supported languages from the i18n config
    const LANG_NAMES = Object.values(LANGUAGE_META).map(meta => meta.nativeName);

    useEffect(() => {
        return onLanguageChange(setCurrentLanguage);
    }, []);

    // Auto-rotate language names every 2.5s with fade transition
    useEffect(() => {
        const interval = setInterval(() => {
            // Fade out
            Animated.timing(langFadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: Platform.OS !== 'web',
                easing: Easing.out(Easing.ease),
            }).start(() => {
                // Switch to next language
                setDisplayLangIndex((prev) => (prev + 1) % LANG_NAMES.length);
                // Fade in
                Animated.timing(langFadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: Platform.OS !== 'web',
                    easing: Easing.in(Easing.ease),
                }).start();
            });
        }, 2500);

        return () => clearInterval(interval);
    }, [langFadeAnim, LANG_NAMES.length]);

    // "Marching ants" border glow — continuous pulse draws attention to the language pill
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(langBorderAnim, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false, // color interpolation needs JS driver
                }),
                Animated.timing(langBorderAnim, {
                    toValue: 0,
                    duration: 1200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
            ])
        );
        pulse.start();

        return () => pulse.stop();
    }, [langBorderAnim]);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[styles.container, style]}
        >
            <Animated.View
                style={[
                    styles.langPill,
                    {
                        borderColor: langBorderAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [colors.border, colors.primary],
                        }),
                    },
                ]}
            >
                <Animated.Text style={[styles.langPillText, { opacity: langFadeAnim }]}>
                    {LANG_NAMES[displayLangIndex]}
                </Animated.Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        zIndex: 50,
    },
    langPill: {
        minWidth: 90,
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: radii.pill,
        borderWidth: 1,
        backgroundColor: colors.surface,
    },
    langPillText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 13,
        color: colors.text,
        letterSpacing: 0.5,
        textAlign: 'center',
    },
});
