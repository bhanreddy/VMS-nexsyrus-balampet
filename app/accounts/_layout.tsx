import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { View, Alert } from 'react-native';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import LogoLoader from '../../src/components/LogoLoader';

export default function AccountsLayout() {
    const { user, loading, logout } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        // If no user is logged in, redirect to accounts-login
        if (!user) {
            router.replace('/accounts-login');
            return;
        }

        // Strict Role Validation: ONLY 'accountant' allowed in this directory
        if (user.role !== 'accountant') {
            Alert.alert(
                'Access Denied',
                'Your account does not have permission to access the Accounts portal.',
                [{ text: 'OK', onPress: () => logout() }]
            );
            router.replace('/accounts-login');
        }
    }, [user, loading, segments]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <LogoLoader size={60} color="#11998e" />
            </View>
        );
    }

    if (!user || user.role !== 'accountant') {
        return null; // Redirect logic in useEffect will handle this
    }

    return (
        <ErrorBoundary>
            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            />
        </ErrorBoundary>
    );
}
