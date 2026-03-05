import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MockComponent = ({ children }: any) => <>{children}</>;

export const Map = ({ style }: any) => (
    <View style={[style, styles.container]}>
        <Text style={styles.text}>Map Tracking is only available on the mobile application.</Text>
    </View>
);

export const Camera = MockComponent;
export const GeoJSONSource = MockComponent;
export const Layer = MockComponent;
export const Marker = MockComponent;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
        borderRadius: 16,
        margin: 16,
        overflow: 'hidden',
    },
    text: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: 20
    }
});
