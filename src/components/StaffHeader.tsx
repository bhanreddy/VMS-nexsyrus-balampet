import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import MenuOverlay from './MenuOverlay';
import { SCHOOL_CONFIG } from '../constants/schoolConfig';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radii } from '../theme/themes';

import Animated, { SharedValue, useAnimatedStyle, interpolateColor, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StaffHeaderProps {
    title: string;
    subtitle?: string;
    showMenuButton?: boolean;
    showProfileButton?: boolean;
    showBackButton?: boolean;
    onMenuPress?: () => void;
    scrollY?: SharedValue<number>;
}

const StaffHeader: React.FC<StaffHeaderProps> = ({
    title = SCHOOL_CONFIG.name,
    subtitle,
    showMenuButton = true,
    showProfileButton = true,
    showBackButton = false,
    onMenuPress,
    scrollY
}) => {
    const router = useRouter();
    const { i18n } = useTranslation();
    const { theme, isDark } = useTheme();
    const [isTelugu, setIsTelugu] = useState(i18n.language === 'te');
    const [menuVisible, setMenuVisible] = useState(false);
    const insets = useSafeAreaInsets();

    React.useEffect(() => {
        setIsTelugu(i18n.language === 'te');
    }, [i18n.language]);

    const toggleLanguage = () => {
        const newLang = !isTelugu;
        setIsTelugu(newLang);
        i18n.changeLanguage(newLang ? 'te' : 'en');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleMenuPress = () => {
        if (onMenuPress) {
            onMenuPress();
        } else {
            setMenuVisible(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const animatedStyle = useAnimatedStyle(() => {
        if (!scrollY) return { backgroundColor: theme.colors.background, shadowOpacity: 0.1 };

        const bgColor = interpolateColor(
            scrollY.value,
            [0, 50],
            ['rgba(255,255,255,0)', isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)']
        );
        const shadowOpacity = interpolate(
            scrollY.value,
            [0, 50],
            [0, 0.1],
            Extrapolation.CLAMP
        );
        return {
            backgroundColor: bgColor,
            shadowOpacity,
            borderBottomColor: theme.colors.borderLight,
            borderBottomWidth: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP)
        };
    });

    const isAbsolute = !!scrollY;

    return (
        <Animated.View style={[
            styles.container,
            { paddingTop: insets.top },
            isAbsolute && styles.absoluteHeader,
            animatedStyle
        ]}>
            <View style={styles.contentRow}>
                {/* Left: Interactive */}
                <View style={styles.leftSection}>
                    {showBackButton ? (
                        <TouchableOpacity
                            onPress={() => router.canGoBack() ? router.back() : router.push('/staff/dashboard' as any)}
                            style={[styles.iconButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.borderLight }]}
                        >
                            <Ionicons name="arrow-back" size={20} color={theme.colors.textStrong} />
                        </TouchableOpacity>
                    ) : showMenuButton && (
                        <TouchableOpacity
                            onPress={handleMenuPress}
                            style={[styles.iconButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.borderLight }]}
                        >
                            <Feather name="menu" size={20} color={theme.colors.textStrong} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Center: Branding (Clean) */}
                <View style={styles.centerSection}>
                    <Text style={[styles.title, { color: theme.colors.textStrong }]}>{title}</Text>
                    {subtitle && (
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
                    )}
                </View>

                {/* Right: Actions */}
                <View style={styles.rightSection}>
                    {/* Lang Switch (Pill) */}
                    <View style={[styles.langPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.borderLight }]}>
                        <TouchableOpacity
                            onPress={() => isTelugu && toggleLanguage()}
                            style={[styles.langOption, !isTelugu && styles.langActive]}
                        >
                            <Text style={[styles.langText, !isTelugu && { color: theme.colors.primary, fontWeight: '700' }]}>En</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => !isTelugu && toggleLanguage()}
                            style={[styles.langOption, isTelugu && styles.langActive]}
                        >
                            <Text style={[styles.langText, isTelugu && { color: theme.colors.primary, fontWeight: '700' }]}>Te</Text>
                        </TouchableOpacity>
                    </View>

                    {showProfileButton && (
                        <TouchableOpacity
                            onPress={() => router.push('/staff/settings' as any)}
                            style={styles.profileButton}
                        >
                            <View style={{
                                width: 32, height: 32, borderRadius: 16,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9',
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: theme.colors.border
                            }}>
                                <Ionicons name="settings-outline" size={20} color={theme.colors.textSecondary} />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <MenuOverlay visible={menuVisible} onClose={() => setMenuVisible(false)} userType="staff" />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 50,
    },
    leftSection: {
        width: 80,
        alignItems: 'flex-start',
    },
    centerSection: {
        flex: 1,
        alignItems: 'center',
    },
    rightSection: {
        width: 80,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: Radii.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '500',
    },
    // Language Pill
    langPill: {
        flexDirection: 'row',
        borderRadius: Radii.pill, // Using arbitrary large radius
        padding: 2,
        height: 28,
        alignItems: 'center',

    },
    langOption: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 99,
    },
    langActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.1)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    langText: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600',
    },
    // Profile
    profileButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    absoluteHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    }
});

export default StaffHeader;