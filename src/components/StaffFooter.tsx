import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Shadows } from '../theme/themes';

const { width } = Dimensions.get('window');

// Map route names to icons and labels
const TAB_CONFIG: Record<string, { icon: string; iconFilled: string; label: string }> = {
    'dashboard': { icon: 'grid-outline', iconFilled: 'grid', label: 'Home' },
    'manage-students': { icon: 'people-outline', iconFilled: 'people', label: 'Attendance' },
    'timetable': { icon: 'calendar-outline', iconFilled: 'calendar', label: 'Schedule' },
    'results': { icon: 'school-outline', iconFilled: 'school', label: 'Results' },
};

// Define the desired order of tabs
const ORDERED_TABS = ['dashboard', 'manage-students', 'timetable', 'results'];

export default function StaffFooter({ state, descriptors, navigation }: any) {
    const isDark = false; // We can context this later if needed

    // Filter and sort routes to only show the main 4 tabs
    const visibleRoutes = state.routes
        .filter((route: any) => ORDERED_TABS.includes(route.name))
        .sort((a: any, b: any) => ORDERED_TABS.indexOf(a.name) - ORDERED_TABS.indexOf(b.name));

    // Calculate active index relative to visible routes
    const currentRouteName = state.routes[state.index].name;
    const activeIndex = visibleRoutes.findIndex((route: any) => route.name === currentRouteName);

    // If the current route is not in the visible footer (e.g. profile), we might want to hide the indicator 
    // or just not render it. For now, we'll clamp it or handle it cleanly.
    // If activeIndex is -1, it means we are on a screen that isn't in the footer.
    const isFooterVisible = activeIndex !== -1;

    // Calculate tab width
    const totalTabs = visibleRoutes.length;
    const tabWidth = (width - 40) / (totalTabs || 1); // Avoid div by zero

    const indicatorPosition = useSharedValue(0);

    useEffect(() => {
        if (activeIndex !== -1) {
            indicatorPosition.value = withSpring(activeIndex * tabWidth, {
                damping: 20,
                stiffness: 140,
            });
        }
    }, [activeIndex, tabWidth]);

    const indicatorStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: indicatorPosition.value }],
            width: tabWidth,
            opacity: withTiming(isFooterVisible ? 1 : 0), // Hide indicator if not on a main tab
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
                    {/* Animated Sliding Underline */}
                    <Animated.View style={[styles.activeIndicatorContainer, indicatorStyle]}>
                        <LinearGradient
                            colors={['#4F46E5', '#818CF8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.activeIndicator}
                        />
                    </Animated.View>

                    {visibleRoutes.map((route: any) => {
                        const { options } = descriptors[route.key];
                        // If the route is in TAB_CONFIG, use it, otherwise fallback (though we filtered so should be fine)
                        const config = TAB_CONFIG[route.name] || { icon: 'ellipse', label: 'Tab' };

                        // Check if this specific tab is the active one
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
                                <Animated.View style={[styles.iconContainer]}>
                                    <Ionicons
                                        name={(isFocused ? config.iconFilled : config.icon) as any}
                                        size={22}
                                        color={isFocused ? '#4F46E5' : (isDark ? '#94A3B8' : '#94A3B8')}
                                    />
                                </Animated.View>
                                <Text
                                    style={[styles.label, {
                                        color: isFocused ? '#4F46E5' : (isDark ? '#64748B' : '#94A3B8'),
                                        fontWeight: isFocused ? '700' : '500',
                                    }]}
                                    numberOfLines={1}
                                >
                                    {config.label}
                                </Text>
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
        height: 64, // Slightly taller for better touch targets
        borderRadius: 32,
        overflow: 'hidden',
    },
    barContent: {
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        paddingHorizontal: 0, // Icons are centered in their flexible width
        borderWidth: 1,
        borderRadius: 32,
    },
    activeIndicatorContainer: {
        position: 'absolute',
        height: '100%',
        justifyContent: 'flex-start',
        alignItems: 'center',
        zIndex: 0,
        paddingTop: 6,
    },
    activeIndicator: {
        width: 32,
        height: 3,
        borderRadius: 2,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 4,
    },
    tabItem: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
        flexDirection: 'column', // Changed to column for better vertical flow
        gap: 4,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 10,
        fontWeight: '500',
        letterSpacing: 0.3,
        marginTop: 2,
    },
});
