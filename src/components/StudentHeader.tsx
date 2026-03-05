import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolateColor, interpolate, useAnimatedStyle, Extrapolation, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import MenuOverlay from './MenuOverlay';
import { Shadows, Radii, Spacing } from '../theme/themes';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StudentHeaderProps {
    onMenuPress?: () => void;
    scrollY?: SharedValue<number>;
    menuUserType?: 'student' | 'staff' | 'driver';
}

const StudentHeader: React.FC<StudentHeaderProps & { showBackButton?: boolean, title?: string, showSettingsButton?: boolean }> = ({ onMenuPress, showBackButton = false, title, showSettingsButton = true, scrollY, menuUserType = 'student' }) => {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const [isTelugu, setIsTelugu] = useState(i18n.language === 'te');
    const [menuVisible, setMenuVisible] = useState(false);
    const insets = useSafeAreaInsets();

    React.useEffect(() => {
        setIsTelugu(i18n.language === 'te');
    }, [i18n.language]);

    const toggleLanguage = async () => {
        const newLang = isTelugu ? 'en' : 'te';
        setIsTelugu(!isTelugu);
        i18n.changeLanguage(newLang);
        await AsyncStorage.setItem('appLanguage', newLang);
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

    const handleTabPress = (tabName: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (tabName === 'Diary') {
            router.push('/Screen/diary' as any);
        } else if (tabName === 'LMS') {
            router.push('/Screen/lms' as any);
        }
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/home');
        }
    };

    const animatedStyle = useAnimatedStyle(() => {
        if (!scrollY) return { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0', shadowOpacity: 0.1 };

        const bgColor = interpolateColor(
            scrollY.value,
            [0, 50],
            ['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)'] // Slight transparency for premium blur feel
        );
        const borderColor = interpolateColor(
            scrollY.value,
            [0, 50],
            ['rgba(226,232,240,0)', 'rgba(226,232,240,1)']
        );
        const shadowOpacity = interpolate(
            scrollY.value,
            [0, 50],
            [0, 0.1],
            Extrapolation.CLAMP
        );

        return {
            backgroundColor: bgColor,
            borderBottomColor: borderColor,
            shadowOpacity,
        };
    });

    const isAbsolute = !!scrollY;

    const fontColorStyle = useAnimatedStyle(() => {
        if (!scrollY) return { color: '#FFFFFF' };
        return {
            color: interpolateColor(
                scrollY.value,
                [0, 50],
                ['#FFFFFF', '#1F2937']
            )
        };
    });

    const iconColorStyle = useAnimatedStyle(() => {
        if (!scrollY) return { backgroundColor: 'rgba(255,255,255,0.1)' };
        return {
            backgroundColor: interpolateColor(
                scrollY.value,
                [0, 50],
                ['rgba(255,255,255,0.1)', '#F8FAFC']
            )
        };
    });

    return (
        <Animated.View style={[
            styles.container,
            { paddingTop: Math.max(insets.top, 36) }, // Guarantee enough space for status bar
            isAbsolute && styles.absoluteHeader,
            animatedStyle
        ]}>
            {!scrollY && (
                <LinearGradient
                    colors={['#05050A', '#13132B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            )}

            {/* Left: Menu or Back Button */}
            {showBackButton ? (
                <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
                    <Animated.View style={[styles.iconButton, iconColorStyle]}>
                        <Animated.Text style={fontColorStyle}>
                            <Ionicons name="arrow-back" size={22} color="inherit" />
                        </Animated.Text>
                    </Animated.View>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity onPress={handleMenuPress} activeOpacity={0.7}>
                    <Animated.View style={[styles.iconButton, iconColorStyle]}>
                        <Animated.Text style={fontColorStyle}>
                            <Ionicons name="menu" size={22} color="inherit" />
                        </Animated.Text>
                    </Animated.View>
                </TouchableOpacity>
            )}

            {/* Title - takes remaining space on sub-pages */}
            {title && (
                <Animated.Text style={[styles.headerTitle, { flex: 1 }, fontColorStyle]}>{title}</Animated.Text>
            )}

            {/* Diary & LMS Tabs - Always show on main screens (no back button, no title) */}
            {!showBackButton && !title && (
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        onPress={() => handleTabPress('Diary')}
                        activeOpacity={0.7}
                    >
                        <Animated.View style={[styles.tabButton, iconColorStyle]}>
                            <View style={[styles.tabIconBox, { backgroundColor: 'rgba(3,105,161,0.1)' }]}>
                                <Ionicons name="book" size={12} color="#0284C7" />
                            </View>
                            <Animated.Text style={[styles.tabText, fontColorStyle]}>{t('diary', 'Diary')}</Animated.Text>
                        </Animated.View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleTabPress('LMS')}
                        activeOpacity={0.7}
                    >
                        <Animated.View style={[styles.tabButton, iconColorStyle]}>
                            <View style={[styles.tabIconBox, { backgroundColor: 'rgba(22,163,74,0.1)' }]}>
                                <MaterialIcons name="computer" size={12} color="#16A34A" />
                            </View>
                            <Animated.Text style={[styles.tabText, fontColorStyle]}>{t('lMS', 'LMS')}</Animated.Text>
                        </Animated.View>
                    </TouchableOpacity>
                </View>
            )}


            <View style={styles.rightActions}>
                {/* Language Toggle */}
                <TouchableOpacity onPress={toggleLanguage} activeOpacity={0.7} style={styles.langToggle}>
                    <Animated.Text style={[styles.langTextCompact, fontColorStyle]}>{isTelugu ? t('languageTelugu') : t('languageEnglish')}</Animated.Text>
                </TouchableOpacity>

                {/* Settings Button */}
                {showSettingsButton && (
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/Screen/settings' as any);
                        }}
                        activeOpacity={0.7}
                        style={{ padding: 4 }}
                    >
                        <Animated.Text style={fontColorStyle}>
                            <Ionicons name="settings-outline" size={20} color="inherit" />
                        </Animated.Text>
                    </TouchableOpacity>
                )}
            </View>

            <MenuOverlay visible={menuVisible} onClose={() => setMenuVisible(false)} userType={menuUserType} />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm + 4, // Added more bottom padding
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'transparent',
        ...Shadows.sm,
    },
    iconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: Radii.sm,
        backgroundColor: '#F8FAFC',
    },
    tabsContainer: {
        flexDirection: 'row',
        marginLeft: Spacing.sm,
        gap: Spacing.xs,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.xs + 2,
        paddingVertical: 4,
        borderRadius: Radii.sm,
        backgroundColor: 'transparent',
        gap: 6,
    },
    tabIconBox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    rightActions: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingRight: Spacing.xs,
    },
    langToggle: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radii.xs,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    langTextCompact: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginLeft: Spacing.md,
        letterSpacing: 0.2,
    },
    absoluteHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
});

export default StudentHeader;
