import React from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';

export const TexturedBackground = ({ children, style }: any) => {
    // For now, just a dark background since we might not have the texture asset
    return (
        <View style={[styles.container, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000', // Dark background for now
    },
});
