import { Stack } from 'expo-router';
import React from 'react';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

export default function GirlSafetyLayout() {
    return (
        <ErrorBoundary>
            <Stack screenOptions={{ headerShown: true }}>
                <Stack.Screen
                    name="index"
                    options={{
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="raise"
                    options={{
                        title: 'Raise a Complaint',
                        headerStyle: { backgroundColor: '#F3E8FF' },
                        headerTintColor: '#4C1D95',
                        headerShadowVisible: false,
                    }}
                />
                <Stack.Screen
                    name="[id]"
                    options={{
                        title: 'Complaint Details',
                        headerStyle: { backgroundColor: '#F8FAFC' },
                        headerTintColor: '#334155',
                        headerShadowVisible: false,
                    }}
                />
            </Stack>
        </ErrorBoundary>
    );
}
