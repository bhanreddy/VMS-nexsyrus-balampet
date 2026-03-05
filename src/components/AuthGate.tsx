import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { ThemeContext } from '../context/ThemeContext';
import LogoLoader from './LogoLoader';

export function AuthGate({ children }: { children: React.ReactNode }) {
    const { isAppLocked, loading } = useAuth();
    // Default fallback colors in case theme isn't fully ready
    const theme = useContext(ThemeContext)?.theme || {
        colors: { background: '#FFFFFF', primary: '#4F46E5', text: '#000000' }
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Always render children so Expo Router doesn't unmount the Stack and crash */}
            {children}

            {(isAppLocked || loading) && (
                <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: theme.colors.background }]}>
                    {loading ? (
                        <LogoLoader size={60} color={theme.colors.primary} />
                    ) : (
                        <View style={styles.lockedWarning}>
                            <Text style={[styles.text, { color: theme.colors.text }]}>
                                App Locked
                            </Text>
                            <Text style={[styles.subText, { color: theme.colors.text }]}>
                                Please unlock with biometrics to continue.
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        zIndex: 99999,
        elevation: 99999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockedWarning: {
        alignItems: 'center',
        padding: 20,
    },
    text: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subText: {
        fontSize: 14,
        opacity: 0.7,
    },
});
