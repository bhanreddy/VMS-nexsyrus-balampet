import {
    FadeInUp,
    FadeInDown,
    FadeIn,
    ZoomIn,
    SlideInRight,
    SlideInDown,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Standardized Spring Configs
export const SPRING_CONFIG = {
    damping: 15,
    stiffness: 150,
    mass: 0.9,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 2,
};

export const SPRING_BOUNCE = {
    damping: 12,
    stiffness: 200,
    mass: 1,
};

// Reusable Reanimated Entering/Exiting Animations
export const Animations = {
    staggerList: (index: number) => FadeInUp.delay(index * 100).springify().damping(15).stiffness(150).mass(0.9),
    staggerFade: (index: number) => FadeIn.delay(index * 100).duration(300),
    slideUpModal: SlideInDown.springify().damping(15).stiffness(150).mass(0.9),
    slideInRight: SlideInRight.springify().damping(15).stiffness(150).mass(0.9),
    fadeInUp: FadeInUp.springify().damping(15).stiffness(150).mass(0.9),
    fadeInDown: FadeInDown.springify().damping(15).stiffness(150).mass(0.9),
    fadeIn: FadeIn.duration(300),
    zoomIn: ZoomIn.springify().damping(15).stiffness(150).mass(0.9),
    slideInFromBottom: SlideInDown.springify().damping(18).stiffness(120),
};

// Haptics Helper
export const HapticFeedback = {
    light: () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    },
    medium: () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    },
    heavy: () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
    },
    success: () => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    },
    error: () => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    }
};

export const PressScaleParams = {
    active: 0.96,
    inactive: 1,
};

export const withSpringBounce = (val: number) => withSpring(val, SPRING_BOUNCE);
export const withSmoothTiming = (val: number, duration = 250) => withTiming(val, { duration });
