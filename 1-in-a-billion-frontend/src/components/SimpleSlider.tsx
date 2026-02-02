import React, { useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';

interface SimpleSliderProps {
    value: number;
    onValueChange: (value: number) => void;
    minimumValue?: number;
    maximumValue?: number;
}

export const SimpleSlider = ({
    value,
    onValueChange,
    minimumValue = 0,
    maximumValue = 10
}: SimpleSliderProps) => {
    const range = maximumValue - minimumValue;
    const percentage = ((value - minimumValue) / range) * 100;

    const [width, setWidth] = React.useState(0);

    return (
        <View>
            <View
                style={styles.container}
                onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
                onTouchStart={(e) => {
                    if (width > 0) {
                        const newValue = (e.nativeEvent.locationX / width) * (maximumValue - minimumValue) + minimumValue;
                        onValueChange(Math.max(minimumValue, Math.min(maximumValue, newValue)));
                    }
                }}
                onTouchMove={(e) => {
                    if (width > 0) {
                        const newValue = (e.nativeEvent.locationX / width) * (maximumValue - minimumValue) + minimumValue;
                        onValueChange(Math.max(minimumValue, Math.min(maximumValue, newValue)));
                    }
                }}
            >
                <View style={styles.track}>
                    <View style={[styles.fill, { width: `${percentage}%` }]} />
                </View>
                <View pointerEvents="none" style={[styles.thumb, { left: `${percentage}%` }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 40,
        justifyContent: 'center',
        width: '100%',
    },
    track: {
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        width: '100%',
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        backgroundColor: colors.primary,
    },
    thumb: {
        position: 'absolute',
        width: 32,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        marginLeft: -16,
        top: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
});
