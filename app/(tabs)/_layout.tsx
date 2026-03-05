import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoleGuard } from '../../src/hooks/useRoleGuard';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/hooks/useAuth';

export default function TabLayout() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { user } = useAuth();
    useRoleGuard(['student']);

    return (
        <ErrorBoundary>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: true,
                    tabBarActiveTintColor: '#1D4ED8',
                    tabBarInactiveTintColor: '#94A3B8',
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 0.3,
                    },
                    tabBarStyle: {
                        height: 58 + insets.bottom,
                        paddingBottom: 6 + insets.bottom,
                        paddingTop: 8,
                        backgroundColor: '#FFFFFF',
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: '#E2E8F0',
                        elevation: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -3 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                    },
                }}
                screenListeners={{
                    tabPress: () => {
                        Haptics.selectionAsync();
                    },
                }}
            >
                <Tabs.Screen
                    name="home"
                    options={{
                        headerShown: false,
                        tabBarLabel: t('dashboard.home', 'Home'),
                        tabBarIcon: ({ focused, color }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
                                {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, position: 'absolute', bottom: -12 }} />}
                            </View>
                        ),
                    }}
                />

                <Tabs.Screen
                    name="timetable"
                    options={{
                        headerShown: false,
                        tabBarLabel: t('timetable.title', 'TimeTable'),
                        tabBarIcon: ({ focused, color }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
                                {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, position: 'absolute', bottom: -12 }} />}
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="fees"
                    options={{
                        headerShown: false,
                        tabBarLabel: t('fees', 'Fees'),
                        tabBarIcon: ({ focused, color }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name={focused ? "wallet" : "wallet-outline"} size={22} color={color} />
                                {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, position: 'absolute', bottom: -12 }} />}
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="results"
                    options={{
                        headerShown: false,
                        tabBarLabel: t('menu.results', 'Results'),
                        tabBarIcon: ({ focused, color }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name={focused ? "school" : "school-outline"} size={22} color={color} />
                                {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, position: 'absolute', bottom: -12 }} />}
                            </View>
                        ),
                    }}
                />

            </Tabs>
        </ErrorBoundary>
    );
}
