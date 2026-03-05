import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withDelay,
    Easing,
    interpolate,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SCHOOL_CONFIG } from "../constants/schoolConfig";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

const PALETTE = {
    voidBase: "#05050A",
    voidDeep: "#0A0A1F",
    voidGlow: "#130F2E",
};

const MOTION = {
    duration: { SLOW: 600, GLOW: 8000 },
    entrance: { BRAND: 100, TITLE: 200, SUB: 300 },
    easing: { SMOOTH: Easing.bezier(0.16, 1, 0.3, 1) },
};

function AmbientGlow({ size, top, left, color, delay }: {
    size: number; top: number; left: number; color: string; delay: number;
}) {
    const p = useSharedValue(0);
    useEffect(() => {
        p.value = withDelay(delay,
            withRepeat(withTiming(1, { duration: MOTION.duration.GLOW, easing: Easing.inOut(Easing.sin) }), -1, true)
        );
    }, []);
    const a = useAnimatedStyle(() => ({
        transform: [
            { scale: interpolate(p.value, [0, 1], [0.95, 1.1]) },
            { translateX: interpolate(p.value, [0, 1], [0, size * 0.05]) },
        ],
        opacity: interpolate(p.value, [0, 1], [0.25, 0.55]),
    }));
    return <Animated.View style={[{ position: "absolute", top, left, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, a]} />;
}

function Reveal({ delayMs, translateY = 20, children, style }: {
    delayMs: number; translateY?: number; children: React.ReactNode; style?: any;
}) {
    const opacity = useSharedValue(0);
    const yOff = useSharedValue(translateY);
    useEffect(() => {
        const tOpacity = withTiming(1, { duration: MOTION.duration.SLOW, easing: MOTION.easing.SMOOTH });
        const tYOff = withTiming(0, { duration: MOTION.duration.SLOW, easing: MOTION.easing.SMOOTH });

        opacity.value = delayMs > 0 ? withDelay(delayMs, tOpacity) : tOpacity;
        yOff.value = delayMs > 0 ? withDelay(delayMs, tYOff) : tYOff;
    }, [delayMs]);

    const a = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: yOff.value }] }));
    return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

interface AuthHeaderProps {
    title: string;
    subtitle: string;
    glowColor?: string; // e.g. "rgba(6,182,212,0.15)" for Cyan
    showLangToggle?: boolean;
}

export default function AuthHeader({ title, subtitle, glowColor = "rgba(79,70,229,0.10)", showLangToggle = true }: AuthHeaderProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { t, i18n } = useTranslation();

    const toggleLanguage = async () => {
        const newLang = i18n.language === 'en' ? 'te' : 'en';
        await i18n.changeLanguage(newLang);
        await AsyncStorage.setItem('appLanguage', newLang);
    };

    return (
        <View style={[styles.headerBox, { paddingTop: insets.top + 10 }]}>
            <LinearGradient
                colors={[PALETTE.voidBase, PALETTE.voidDeep, PALETTE.voidGlow]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <AmbientGlow size={width * 1.4} top={-width * 0.5} left={-width * 0.2} color={glowColor} delay={0} />

            <View style={StyleSheet.absoluteFill}>
                <View style={[styles.gridH, { top: "30%" }]} />
                <View style={[styles.gridH, { top: "70%" }]} />
                <View style={[styles.gridV, { left: "15%" }]} />
                <View style={[styles.gridV, { left: "85%" }]} />
            </View>

            <View style={styles.headerContent}>
                <Reveal delayMs={0} style={styles.topBar}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>

                    <View style={styles.rightHeaderControls}>
                        {/* Language Toggler */}
                        {showLangToggle && (
                            <TouchableOpacity style={styles.langToggleBtn} onPress={toggleLanguage}>
                                <Text style={i18n.language === 'en' ? styles.langActive : styles.langInactive}>
                                    {t('languageEnglish')}
                                </Text>
                                <Text style={styles.langSeparator}> | </Text>
                                <Text style={i18n.language === 'te' ? styles.langActive : styles.langInactive}>
                                    {t('languageTelugu')}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.brandPill}>
                            <LinearGradient
                                colors={["rgba(255,255,255,0.04)", "transparent"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={[StyleSheet.absoluteFill, { borderRadius: 100 }]}
                            />
                            <View style={styles.logoCircle}>
                                <Image source={SCHOOL_CONFIG.logo} style={styles.logoImage} />
                            </View>
                            <Text style={styles.brandName}>{SCHOOL_CONFIG.name}</Text>
                        </View>
                    </View>
                </Reveal>

                <Reveal delayMs={MOTION.entrance.TITLE} translateY={15} style={styles.titleContainer}>
                    <Text style={styles.titleText}>{title}</Text>
                    <Text style={styles.subtitleText}>{subtitle}</Text>
                </Reveal>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    headerBox: {
        paddingBottom: 110, // Match overlap
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        overflow: "hidden",
        position: "relative",
        backgroundColor: PALETTE.voidBase,
    },
    headerContent: {
        paddingHorizontal: 24,
        zIndex: 10,
    },
    gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.02)" },
    gridV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.02)" },

    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 32,
    },
    backBtn: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.05)",
        alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    },
    brandPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingRight: 14,
        paddingVertical: 4,
        paddingLeft: 4,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderRadius: 100,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        overflow: "hidden",
    },
    logoCircle: {
        width: 24, height: 24,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        alignItems: "center", justifyContent: "center",
        marginRight: 8,
    },
    logoImage: { width: 14, height: 14, resizeMode: "contain" },
    brandName: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },

    titleContainer: {
        marginTop: 10,
    },
    titleText: {
        fontSize: 32,
        fontWeight: "900",
        color: "#FFFFFF",
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    subtitleText: {
        fontSize: 15,
        color: "rgba(255,255,255,0.6)",
        fontWeight: "500",
        lineHeight: 22,
    },
    rightHeaderControls: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    langToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    langActive: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    langInactive: {
        color: 'rgba(255,255,255,0.5)',
        fontWeight: 'normal',
        fontSize: 12,
    },
    langSeparator: {
        color: 'rgba(255,255,255,0.3)',
        marginHorizontal: 4,
        fontSize: 12,
    }
});
