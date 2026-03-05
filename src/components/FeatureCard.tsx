
import React from 'react';
import { TouchableWithoutFeedback, View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from 'phosphor-react-native/src/icons/User';
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle';
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { Bed } from 'phosphor-react-native/src/icons/Bed';
import { Bus } from 'phosphor-react-native/src/icons/Bus';
import { Heart } from 'phosphor-react-native/src/icons/Heart';
import { Flask } from 'phosphor-react-native/src/icons/Flask';
import { FileText } from 'phosphor-react-native/src/icons/FileText';
import { IconProps } from 'phosphor-react-native';
import { HapticFeedback } from '../utils/animations';

const { width } = Dimensions.get('window');
const padding = 20; // Must match gridContainer paddingHorizontal
const gap = 16; // Fixed 16px gap between cards
const CARD_WIDTH = (width - (padding * 2) - gap) / 2;

const IconMap = {
    User,
    WarningCircle,
    ChatCircleDots,
    Bed,
    Bus,
    Heart,
    Flask,
    FileText,
};

export type IconName = keyof typeof IconMap;

interface FeatureCardProps {
    title: string;
    icon: IconName;
    colors: [string, string, ...string[]];
    badgeCount?: number;
    isPrimary?: boolean;
    priority?: 'high' | 'medium' | 'low'; // Added priority level
    onPress: () => void;
}

export default function FeatureCard({ title, icon, colors, badgeCount, priority = 'medium', isPrimary, onPress }: FeatureCardProps) {
    const scale = useSharedValue(1);
    const shadowOp = useSharedValue(0.05); // Base soft shadow opacity
    const shadowY = useSharedValue(6); // Base shadow offset Y

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            shadowOpacity: shadowOp.value,
            shadowOffset: { width: 0, height: shadowY.value },
        };
    });

    const handlePressIn = () => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
        shadowOp.value = withSpring(0.02, { damping: 15, stiffness: 300 }); // Compress shadow opacity
        shadowY.value = withSpring(2, { damping: 15, stiffness: 300 }); // Compress shadow depth
        HapticFeedback.light();
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 }); // Friendly, softer bounce
        shadowOp.value = withSpring(0.08, { damping: 15, stiffness: 200 }); // Restore shadow
        shadowY.value = withSpring(6, { damping: 15, stiffness: 200 }); // Restore depth
    };

    const IconComponent = IconMap[icon] as React.ElementType<IconProps>;

    return (
        <TouchableWithoutFeedback
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Animated.View style={[
                styles.container,
                animatedStyle,
            ]}>
                {/* 1. Volumetric Tinted Card Background */}
                <LinearGradient
                    colors={[colors[0] + '33', colors[1] + '1A']} // Brighter 20% fading to 10% gradient
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* 2. Soft Ambient Card Glow (using primary accent color) */}
                <View style={[
                    StyleSheet.absoluteFillObject,
                    { backgroundColor: colors[0], opacity: 0.05 }
                ]} />

                <View style={styles.cardInner}>
                    {/* 3. Drop shadow specifically for the icon box to create lift */}
                    <View style={[styles.iconBoxShadowWrap, { shadowColor: colors[0] }]}>
                        {/* 4. Glassmorphic Gradient Icon Block */}
                        <LinearGradient
                            colors={colors as [string, string, ...string[]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[
                                styles.iconBox,
                                priority === 'high' && { borderColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1.5 },
                                priority === 'low' && { opacity: 0.85 }
                            ]}
                        >
                            <View style={[
                                styles.glassHighlight,
                                priority === 'high' && { backgroundColor: 'rgba(255,255,255,0.25)' }
                            ]} />
                            {IconComponent && <IconComponent size={24} color="#FFFFFF" weight="fill" />}
                            {!!badgeCount && badgeCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                                </View>
                            )}
                        </LinearGradient>
                    </View>
                    <View style={styles.textContainer}>
                        <Text
                            style={[
                                styles.title,
                                isPrimary && styles.titlePrimary,
                                priority === 'low' && { color: '#64748B' }
                            ]}
                        >
                            {title}
                        </Text>
                    </View>
                </View>
            </Animated.View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        width: CARD_WIDTH,
        height: 72, // Significantly reduced height for horizontal pill-like row item
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.06,
        shadowRadius: 24,
        elevation: 6,
        overflow: 'hidden',
    },
    cardInner: {
        flex: 1,
        flexDirection: 'row',
        padding: 10, // Reduced from 12 to maximize horizontal space for text
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 10, // Reduced gap between icon and text 
        zIndex: 1,
        backgroundColor: 'transparent',
    },
    iconBoxShadowWrap: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 3,
        borderRadius: 16,
    },
    iconBox: {
        width: 48, // Shrunk to match the shorter card height
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        overflow: 'hidden',
    },
    glassHighlight: {
        position: 'absolute',
        top: 0, left: 0, right: 0, height: 32,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 8,
        overflow: 'hidden',
    },
    title: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
        color: '#334155',
        letterSpacing: -0.2,
        flexShrink: 1,
    },
    titlePrimary: {
        fontSize: 13,
        lineHeight: 16,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.2,
    },
});
