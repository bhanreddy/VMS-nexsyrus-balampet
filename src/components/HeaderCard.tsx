import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { SCHOOL_CONFIG } from '../constants/schoolConfig';
import { Radii, Spacing } from '../theme/themes';

interface HeaderCardProps {
    studentName: string;
    classSec: string;
    rollNo: string;
}

const { width } = Dimensions.get('window');

const HeaderCard: React.FC<HeaderCardProps> = ({
    studentName,
    classSec,
    rollNo,
}) => {
    const { t } = useTranslation();
    /* ---------------- Animations ---------------- */
    const shimmerX = useSharedValue(-width);
    const pulse = useSharedValue(1);

    useEffect(() => {
        shimmerX.value = withRepeat(
            withTiming(width * 1.5, {
                duration: 3000,
                easing: Easing.linear,
            }),
            -1,
            false
        );

        pulse.value = withRepeat(
            withTiming(1.5, {
                duration: 1500,
                easing: Easing.out(Easing.ease),
            }),
            -1,
            true
        );
    }, []);


    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
        opacity: 0.22,
    }));

    /* ---------------- UI ---------------- */
    return (
        <Animated.View
            entering={FadeInDown.duration(700).springify()}
            style={styles.wrapper}
        >
            <View style={styles.card}>

                {/* School Badge — elevated pill */}
                <View style={[styles.schoolBadge, { marginTop: 16 }]}>
                    <View style={styles.logoContainer}>
                        <Image source={SCHOOL_CONFIG.logo} style={styles.schoolLogo} />
                    </View>
                    <Text style={styles.schoolName} numberOfLines={1}>
                        {SCHOOL_CONFIG.name}
                    </Text>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Avatar with cyan glow for student */}
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatarGlow} />
                        <View style={styles.avatarBorder}>
                            <Image
                                source={{
                                    uri: 'https://cdn-icons-png.flaticon.com/512/4333/4333609.png',
                                }}
                                style={styles.avatar}
                            />
                        </View>

                        {/* Status indicator */}
                        <View style={styles.status}>
                            <Animated.View style={[styles.statusPulse, pulseStyle]} />
                            <View style={styles.statusDot} />
                        </View>
                    </View>

                    {/* Student Info */}
                    <View style={styles.info}>
                        <Text style={styles.studentName} numberOfLines={1}>
                            {studentName?.replace(/\s+/g, ' ')}
                        </Text>

                        <View style={styles.metaRow}>
                            <View style={styles.metaPill}>
                                <Ionicons name="layers" size={13} color="#67E8F9" />
                                <Text style={styles.metaText}>{classSec}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.metaPill}>
                                <Ionicons name="id-card" size={13} color="#67E8F9" />
                                <Text style={styles.metaText}>{t('rollValue', { value: rollNo }) || `Roll ${rollNo}`}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

export default HeaderCard;

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
    wrapper: {
        marginHorizontal: 20,
        marginTop: Spacing.lg,
    },

    /* Card */
    card: {
        padding: Spacing.md,
        paddingBottom: Spacing.xl, // Space for overlap
        backgroundColor: 'transparent',
    },

    glassOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },

    shimmer: {
        ...StyleSheet.absoluteFillObject,
        transform: [{ skewX: '-18deg' }],
    },

    schoolBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.1)', // softer
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5, // more compact
        borderRadius: Radii.pill,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },

    logoContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2,
    },

    schoolLogo: {
        width: 18,
        height: 18,
        resizeMode: 'contain',
    },

    schoolName: {
        color: '#FFFFFF',
        fontWeight: '700', // removed 800
        fontSize: 12, // smaller
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        maxWidth: width * 0.5,
    },

    /* Content */
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.lg + 2,
    },

    avatarWrap: {
        position: 'relative',
    },

    avatarGlow: {
        position: 'absolute',
        width: 74,
        height: 74,
        borderRadius: 24,
        backgroundColor: '#06B6D4',
        opacity: 0.15, // softer
        top: -3,
        left: -3,
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4,
    },

    avatarBorder: {
        width: 68,
        height: 68,
        borderRadius: 22,
        padding: 2,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },

    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
        backgroundColor: '#1E1042',
    },

    status: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },

    statusPulse: {
        position: 'absolute',
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#22c55e',
    },

    statusDot: {
        width: 13,
        height: 13,
        borderRadius: 7,
        backgroundColor: '#22c55e',
        borderWidth: 2.5,
        borderColor: '#3B0764',
    },

    info: {
        flex: 1,
    },

    studentName: {
        color: '#FFFFFF',
        fontSize: 26, // Increased name emphasis
        fontWeight: '800',
        letterSpacing: 0.3,
        marginBottom: Spacing.xs, // tighter spacing
        textShadowColor: 'rgba(0,0,0,0.15)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },

    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    metaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },

    metaText: {
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '600',
        fontSize: 12,
        letterSpacing: 0.2,
    },

    divider: {
        width: 1,
        height: 14,
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginHorizontal: 11,
    },
});
