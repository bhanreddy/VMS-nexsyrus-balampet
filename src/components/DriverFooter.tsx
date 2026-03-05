import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    FadeIn,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Shadows } from '../theme/themes';

const { width } = Dimensions.get('window');

// Map route names to icons and labels
const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
    'dashboard': { icon: 'bus-outline', label: 'Route' },
    'students': { icon: 'people-outline', label: 'Students' },
    'payslip': { icon: 'wallet-outline', label: 'Payslips' },
    'profile': { icon: 'person-outline', label: 'Profile' },
};

// Define the desired order of tabs
const ORDERED_TABS = ['dashboard', 'students', 'payslip', 'profile'];

// Driver Accent Pink
const ACTIVE_G_START = '#F472B6';
const ACTIVE_G_END = '#DB2777';

export default function DriverFooter({ state, descriptors, navigation }: MaterialTopTabBarProps) {
    const isDark = false;

    // Filter and sort routes to only show the main 3 tabs
    const visibleRoutes = state.routes
        .filter(route => ORDERED_TABS.includes(route.name))
        .sort((a, b) => ORDERED_TABS.indexOf(a.name) - ORDERED_TABS.indexOf(b.name));

    // Calculate active index relative to visible routes
    const currentRouteName = state.routes[state.index].name;
    const activeIndex = visibleRoutes.findIndex(route => route.name === currentRouteName);
    const isFooterVisible = activeIndex !== -1;

    // Calculate tab width
    const totalTabs = visibleRoutes.length;
    const tabWidth = (width - 40) / (totalTabs || 1);

    const indicatorPosition = useSharedValue(0);

    useEffect(() => {
        if (activeIndex !== -1) {
            indicatorPosition.value = withSpring(activeIndex * tabWidth, {
                damping: 15,
                stiffness: 150,
            });
        }
    }, [activeIndex, tabWidth]);

    const indicatorStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: indicatorPosition.value }],
            width: tabWidth,
            opacity: withTiming(isFooterVisible ? 1 : 0),
        };
    });

    return (
        <View style={styles.container}>
            <View style={[styles.barWrapper, Shadows.md]}>
                <BlurView
                    intensity={Platform.OS === 'ios' ? 80 : 30}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                    colors={isDark
                        ? ['rgba(30, 41, 59, 0.7)', 'rgba(15, 23, 42, 0.8)']
                        : ['rgba(255, 255, 255, 0.8)', 'rgba(241, 245, 249, 0.9)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.barContent, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)' }]}
                >
                    <Animated.View style={[styles.activeIndicatorContainer, indicatorStyle]}>
                        <LinearGradient
                            colors={[ACTIVE_G_START, ACTIVE_G_END]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.activeIndicator}
                        />
                    </Animated.View>

                    {visibleRoutes.map((route) => {
                        const { options } = descriptors[route.key];
                        const config = TAB_CONFIG[route.name] || { icon: 'ellipse', label: 'Tab' };
                        const isFocused = currentRouteName === route.name;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });
                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name, route.params);
                            }
                        };

                        return (
                            <TouchableOpacity
                                key={route.key}
                                onPress={onPress}
                                style={styles.tabItem}
                                activeOpacity={0.7}
                            >
                                <View style={styles.iconContainer}>
                                    <Ionicons
                                        name={config.icon as any}
                                        size={22}
                                        color={isFocused ? '#ffffff' : (isDark ? '#94A3B8' : '#64748B')}
                                    />
                                </View>
                                {isFocused && (
                                    <Animated.Text
                                        entering={FadeIn.duration(200)}
                                        style={[styles.label, { color: '#ffffff' }]}
                                        numberOfLines={1}
                                    >
                                        {config.label}
                                    </Animated.Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </LinearGradient>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    barWrapper: {
        flexDirection: 'row',
        width: '100%',
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
    },
    barContent: {
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        paddingHorizontal: 0,
        borderWidth: 1,
        borderRadius: 32,
    },
    activeIndicatorContainer: {
        position: 'absolute',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 0,
    },
    activeIndicator: {
        width: '70%',
        height: 60,
        borderRadius: 22,
        shadowColor: ACTIVE_G_END,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    tabItem: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
        flexDirection: 'column',
        gap: 4,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});
