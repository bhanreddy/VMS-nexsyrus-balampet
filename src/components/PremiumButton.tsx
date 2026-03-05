import React, { useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import LogoLoader from './LogoLoader';

interface PremiumButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    colors: [string, string, ...string[]]; // Gradient colors
    icon?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

const MOTION = {
    duration: { FAST: 150 },
    easing: { SMOOTH: Easing.bezier(0.16, 1, 0.3, 1) },
    spring: { damping: 15, stiffness: 200, mass: 0.8 },
};

const PremiumButton: React.FC<PremiumButtonProps> = ({
    title,
    onPress,
    loading = false,
    disabled = false,
    colors,
    icon,
    style,
    textStyle,
}) => {
    const scale = useSharedValue(1);

    const handlePressIn = useCallback(() => {
        if (!disabled && !loading) {
            scale.value = withTiming(0.97, { duration: MOTION.duration.FAST, easing: MOTION.easing.SMOOTH });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [disabled, loading]);

    const handlePressOut = useCallback(() => {
        if (!disabled && !loading) {
            scale.value = withSpring(1, MOTION.spring);
        }
    }, [disabled, loading]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={[styles.container, style, animatedStyle]}>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                style={styles.touchable}
            >
                <LinearGradient
                    colors={disabled ? ['#E2E8F0', '#CBD5E1'] : colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradient}
                >
                    {loading ? (
                        <LogoLoader color={disabled ? '#94A3B8' : '#FFFFFF'} />
                    ) : (
                        <>
                            <Text style={[styles.title, disabled && styles.titleDisabled, textStyle]}>
                                {title}
                            </Text>
                            {icon && icon}
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    touchable: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden', // clips gradient to rounded corners
    },
    gradient: {
        width: '100%',
        height: 60,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    titleDisabled: {
        color: '#94A3B8',
    },
});

export default PremiumButton;
