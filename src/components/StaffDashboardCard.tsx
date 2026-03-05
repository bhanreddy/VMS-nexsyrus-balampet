import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    FadeInUp,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { Springs } from '../utils/motion';
import { Radii, Spacing } from '../theme/themes';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_PADDING = 20;
// 2-column grid
const CARD_WIDTH = (width - CARD_PADDING * 2 - CARD_GAP) / 2;

// ── Types ───────────────────────────────────
interface StaffDashboardCardProps {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    gradientColors?: [string, string];
    onPress: () => void;
    index?: number;
    badge?: string | number;
    minHeight?: number;
}

// ── Component ───────────────────────────────
export default function StaffDashboardCard({
    title,
    subtitle,
    icon,
    gradientColors,
    onPress,
    index = 0,
    badge,
    minHeight = 120, // Increased height for better presence
}: StaffDashboardCardProps) {
    const { isDark } = useTheme();
    const scale = useSharedValue(1);

    const animatedCardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    // Default to a professional slate if no gradient provided
    const gradStart = gradientColors?.[0] || '#475569';
    const gradEnd = gradientColors?.[1] || '#334155';

    return (
        <Animated.View
            entering={FadeInUp.delay(index * 50).duration(500).springify().damping(12)}
            style={styles.wrapper}
        >
            <Animated.View style={[styles.container, animatedCardStyle]}>
                <Pressable
                    onPressIn={() => {
                        scale.value = withSpring(0.96, Springs.cardPress);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    onPressOut={() => {
                        scale.value = withSpring(1, Springs.cardRelease);
                    }}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onPress();
                    }}
                    style={styles.pressable}
                >
                    {/* Shadow Layer for "Glow" effect */}
                    <View style={[styles.glowShadow, { backgroundColor: gradStart }]} />

                    <LinearGradient
                        colors={[gradStart, gradEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.cardBg, { minHeight }]}
                    >
                        {/* 1. Watermark Icon (Background) */}
                        <View style={styles.watermarkContainer}>
                            {/* We clone the icon and scale it up drastically for texture */}
                            {React.isValidElement(icon) && React.cloneElement(icon as any, {
                                size: 100,
                                color: 'rgba(255,255,255,0.07)'
                            })}
                        </View>

                        {/* 2. Glassy Shine Overlay */}
                        <LinearGradient
                            colors={['rgba(255,255,255,0.15)', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0.8, y: 0.8 }}
                            style={StyleSheet.absoluteFillObject}
                        />

                        {/* 3. Inner Highlight Border */}
                        <View style={styles.innerHighlight} />

                        {/* 4. Content Content */}
                        <View style={styles.contentContainer}>
                            {/* Top Row: Icon Container and Badge */}
                            <View style={styles.topRow}>
                                <View style={styles.iconGlassContainer}>
                                    {/* Inner subtle gradient for the icon box */}
                                    <View style={styles.iconGlassBg} />
                                    {isActiveIcon(icon) ? React.cloneElement(icon as any, { size: 22, color: '#FFF' }) : icon}
                                </View>
                                {badge !== undefined && badge !== null && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{badge}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Bottom Row: Typography */}
                            <View style={styles.bottomContent}>
                                <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
                                    {title}
                                </Text>
                                {subtitle && (
                                    <Text style={styles.subtitle} numberOfLines={1}>
                                        {subtitle}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </LinearGradient>
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

function isActiveIcon(node: React.ReactNode): boolean {
    return React.isValidElement(node);
}

// ── Styles ──────────────────────────────────
const styles = StyleSheet.create({
    wrapper: {
        width: CARD_WIDTH,
        marginBottom: CARD_GAP,
    },
    container: {
        position: 'relative',
    },
    pressable: {
        flex: 1,
        borderRadius: 24, // More pronounced curve
    },
    glowShadow: {
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        height: '100%',
        borderRadius: 24,
        opacity: 0.25,
        transform: [{ translateY: 4 }, { scale: 0.9 }],
        // We simulate elevation with this colored view
    },
    cardBg: {
        flex: 1,
        padding: 16,
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
    },
    watermarkContainer: {
        position: 'absolute',
        bottom: -20,
        right: -20,
        transform: [{ rotate: '-15deg' }],
        zIndex: 0,
    },
    innerHighlight: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 24,
        zIndex: 2,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'space-between',
        zIndex: 1, // Above watermark
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    iconGlassContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)', // Glassy
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
    },
    iconGlassBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    badge: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radii.pill,
        minWidth: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: 'rgba(0,0,0,0.2)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 3,
    },
    badgeText: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        fontWeight: '800',
        color: '#0F172A',
        fontSize: 11,
    },
    bottomContent: {
        marginTop: 12,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 2,
        letterSpacing: -0.3,
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    subtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '500',
        letterSpacing: 0,
    },
});
