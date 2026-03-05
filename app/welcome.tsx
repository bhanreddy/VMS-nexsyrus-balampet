import React, { useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, Image, Platform, StatusBar, ScrollView } from 'react-native';
import { FontAwesome5, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useAuth } from "../src/hooks/useAuth";
;
import { SCHOOL_CONFIG } from "../src/constants/schoolConfig";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");

/* ═══════════════════════════════════════════════════════
   PREMIUM SAAS TOKENS — Vercel / Linear Aesthetic
   ═══════════════════════════════════════════════════════ */
const PALETTE = {
  // Ultra-deep header void
  voidBase: "#05050A",
  voidDeep: "#0A0A1F",
  voidGlow: "#130F2E",

  // Accents
  primary: "#4F46E5", // Indigo
  accent: "#06B6D4",  // Cyan (Deepened slightly for balance)
  glow: "#A855F7",    // Purple

  // Surfaces
  surfaceMain: "#F8FAFC", // Slate 50
  surfaceCard: "#FFFFFF",
  surfaceInverted: "#1E293B", // Slate 800 (Lightened from 900)

  // Ink
  inkDark: "#0F172A",
  inkMuted: "#64748B",
  inkWhite: "#FFFFFF",
  inkWhiteMuted: "#94A3B8",
} as const;

const MOTION = {
  duration: { FAST: 150, MEDIUM: 400, SLOW: 600, GLOW: 8000 },
  entrance: {
    BRAND: 100, HERO_BADGE: 200, HERO_TITLE: 300, HERO_SUB: 450,
    CARDS: 600, FOOTER: 900,
  },
  easing: {
    SMOOTH: Easing.bezier(0.16, 1, 0.3, 1),
    SPRING: Easing.bezier(0.34, 1.56, 0.64, 1),
  },
  spring: { damping: 18, stiffness: 200, mass: 0.7 },
} as const;

/* ═══════════════════════════════════════════════════════
   MASSIVE GLOW ORB — Soft focal point gradient
   ═══════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════
   REVEAL
   ═══════════════════════════════════════════════════════ */
function Reveal({ delayMs, translateY = 20, children, style }: {
  delayMs: number; translateY?: number; children: React.ReactNode; style?: any;
}) {
  const opacity = useSharedValue(0);
  const yOff = useSharedValue(translateY);
  useEffect(() => {
    opacity.value = withDelay(delayMs, withTiming(1, { duration: MOTION.duration.SLOW, easing: MOTION.easing.SMOOTH }));
    yOff.value = withDelay(delayMs, withTiming(0, { duration: MOTION.duration.SLOW, easing: MOTION.easing.SMOOTH }));
  }, [delayMs]);

  const a = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: yOff.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}


/* ═══════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════ */
export default function Index() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {loading || user ? (
        // Just return an empty void background. The _layout.tsx overlay covers this
        // until either loading completes, or the user is redirected to the dashboard.
        <View style={[styles.loadWrap, { backgroundColor: PALETTE.voidBase }]} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} bounces={false} showsVerticalScrollIndicator={false}>

          {/* ══════════════════════════════════════════════════
             HERO HEADER — Deep void + overlapping structure
             ══════════════════════════════════════════════════ */}
          <View style={[styles.headerBox, { paddingTop: insets.top + 20 }]}>

            {/* Background Base */}
            <LinearGradient
              colors={[PALETTE.voidBase, PALETTE.voidDeep, PALETTE.voidGlow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Massive Ambient Glows */}
            <AmbientGlow size={width * 1.4} top={-width * 0.5} left={-width * 0.2} color="rgba(79,70,229,0.10)" delay={0} />
            <AmbientGlow size={width * 1.1} top={height * 0.1} left={width * 0.4} color="rgba(168,85,247,0.04)" delay={4000} />

            {/* Geometric Grid — Faint and sharp */}
            <View style={StyleSheet.absoluteFill}>
              <View style={[styles.gridH, { top: "20%" }]} />
              <View style={[styles.gridH, { top: "60%" }]} />
              <View style={[styles.gridV, { left: "15%" }]} />
              <View style={[styles.gridV, { left: "85%" }]} />
            </View>

            {/* Content Container */}
            <View style={styles.headerContent}>

              {/* Brand Logo & Name (Premium Capsule) */}
              <Reveal delayMs={MOTION.entrance.BRAND} style={styles.brandPill}>
                {/* Inner Highlight Gradient */}
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
              </Reveal>

              {/* Eyebrow Badge */}
              <Reveal delayMs={MOTION.entrance.HERO_BADGE}>
                <View style={styles.eyebrowBadge}>
                  <Text style={styles.eyebrowText}>✨  WELCOME TO THE FUTURE</Text>
                </View>
              </Reveal>

              {/* Hero Typography — Massive & Editorial */}
              <Reveal delayMs={MOTION.entrance.HERO_TITLE} translateY={10}>
                <Text style={styles.heroTextMain}>Futuristic</Text>
                <Text style={styles.heroTextAccent}>Next-Gen</Text>
                <Text style={styles.heroTextMain}>Education.</Text>
              </Reveal>

              {/* Social Proof Avatar Group / Trust */}
              <Reveal delayMs={MOTION.entrance.HERO_SUB} translateY={10} style={styles.trustRow}>
                <View style={styles.avatarGroup}>
                  <View style={[styles.avatarCircle, { backgroundColor: "#3B82F6", zIndex: 3 }]} />
                  <View style={[styles.avatarCircle, { backgroundColor: "#10B981", marginLeft: -10, zIndex: 2 }]} />
                  <View style={[styles.avatarCircle, { backgroundColor: "#8B5CF6", marginLeft: -10, zIndex: 1 }]} />
                </View>
                <Text style={styles.trustText}>Trusted by many institutions.</Text>
              </Reveal>

            </View>
          </View>

          {/* ══════════════════════════════════════════════════
             OVERLAPPING BODY — The 100x SaaS Layout Technique
             ══════════════════════════════════════════════════ */}
          <View style={styles.bodyContainer}>

            {/* The negative margin overlap container */}
            <View style={styles.overlapSection}>

              <Reveal delayMs={MOTION.entrance.CARDS} translateY={40}>
                <View style={styles.cardsGrid}>

                  {/* PRIMARY HERO CARD (Student) — Inverted Dark Theme */}
                  <ActionCard
                    icon={<FontAwesome5 name="user-graduate" size={20} color="#FFFFFF" />}
                    title={t("index.student_login")}
                    subtitle="Grades, attendance & portal"
                    accent={PALETTE.accent}
                    onPress={() => router.push("/login")}
                    isPrimary
                  />

                  {/* SECONDARY CARDS — Light Theme */}
                  <ActionCard
                    icon={<Ionicons name="people" size={22} color="#059669" />}
                    title={t("index.staff_login")}
                    subtitle="Classes, records & reports"
                    accent="#059669"
                    onPress={() => router.push("/staff-login")}
                  />

                  <ActionCard
                    icon={<MaterialIcons name="admin-panel-settings" size={22} color="#7C3AED" />}
                    title={t("index.admin_login")}
                    subtitle="Full school management"
                    accent="#7C3AED"
                    onPress={() => router.push("/admin-login")}
                  />

                  <ActionCard
                    icon={<FontAwesome5 name="wallet" size={16} color="#D97706" />}
                    title={t("index.accounts_login") || "Accounts Portal"}
                    subtitle="Finance & fee tracking"
                    accent="#D97706"
                    onPress={() => router.push("/accounts-login")}
                  />

                  {/* Driver Portal */}
                  <ActionCard
                    icon={<MaterialIcons name="directions-bus" size={22} color="#EC4899" />}
                    title="Driver Portal"
                    subtitle="Live tracking & trip management"
                    accent="#EC4899"
                    onPress={() => router.push("/driver-login")}
                  />

                </View>
              </Reveal>

              {/* Minimal Footer */}
              <Reveal delayMs={MOTION.entrance.FOOTER} style={styles.footerSection}>
                <View style={styles.footerDivider} />
                <Text style={styles.footerBrand}>POWERED BY NexSyrus IMS </Text>
                <Text style={styles.footerVersion}>v 2.0.0</Text>
              </Reveal>

            </View>
          </View>

        </ScrollView>
      )}
    </View>
  );
}


/* ═══════════════════════════════════════════════════════
   PREMIUM ACTION CARD Component
   ═══════════════════════════════════════════════════════ */
interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
  isPrimary?: boolean;
}

function ActionCard({ icon, title, subtitle, accent, onPress, isPrimary }: ActionCardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.97, { duration: MOTION.duration.FAST, easing: MOTION.easing.SMOOTH });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, MOTION.spring);
  }, []);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (isPrimary) {
    // Inverted Dark Card for Primary Action
    return (
      <Animated.View style={[styles.cardBase, styles.cardInverted, aStyle, styles.cardShadowPrimary]}>
        <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.cardPressable}>
          <View style={[styles.cardStrip, { backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }]} />

          <View style={styles.cardIconBoxInverted}>
            {icon}
          </View>

          <View style={styles.cardTextCol}>
            <Text style={styles.cardTitleInverted} numberOfLines={1}>{title}</Text>
            <Text style={styles.cardSubInverted} numberOfLines={1}>{subtitle}</Text>
          </View>

          <View style={[styles.chevronBox, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  // Standard Light Card
  return (
    <Animated.View style={[styles.cardBase, styles.cardLight, aStyle, styles.cardShadowLight]}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.cardPressable}>
        <View style={[styles.cardStrip, { backgroundColor: accent }]} />

        <View style={[styles.cardIconBoxLight, { backgroundColor: `${accent}10` }]}>
          {icon}
        </View>

        <View style={styles.cardTextCol}>
          <Text style={styles.cardTitleLight} numberOfLines={1}>{title}</Text>
          <Text style={styles.cardSubLight} numberOfLines={1}>{subtitle}</Text>
        </View>

        <View style={[styles.chevronBox, { backgroundColor: PALETTE.surfaceMain }]}>
          <Ionicons name="chevron-forward" size={16} color={PALETTE.inkMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}


/* ═══════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════ */
const CARD_HEIGHT = 88;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.surfaceMain },
  loadWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: PALETTE.surfaceMain },

  /* ─── HEADER ─── */
  headerBox: {
    paddingBottom: 110, // Tall padding to allow overlap
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
    position: "relative",
    backgroundColor: PALETTE.voidBase,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    zIndex: 10,
  },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.02)" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.02)" },

  /* ─── BRAND PILL ─── */
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 44,
    paddingRight: 14,
    paddingVertical: 4,
    paddingLeft: 4,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)", // Purely optical border
    overflow: "hidden", // ensures inner gradient stays inside
  },
  logoCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    // Add sharp shadow to make the white circle pop
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  logoImage: {
    width: 16,
    height: 16,
    resizeMode: "contain",
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },

  /* ─── HERO SEC ─── */
  eyebrowBadge: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 20,
  },
  eyebrowText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  heroTextMain: {
    fontSize: 44,
    fontWeight: "900",
    color: PALETTE.surfaceMain,
    letterSpacing: -1,
    lineHeight: 48,
  },
  heroTextAccent: {
    fontSize: 44,
    fontWeight: "900",
    color: PALETTE.accent,
    letterSpacing: -1,
    lineHeight: 48,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
  },
  avatarGroup: {
    flexDirection: "row",
    marginRight: 12,
  },
  avatarCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: PALETTE.voidDeep,
  },
  trustText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "500",
  },

  /* ─── BODY LAYOUT ─── */
  bodyContainer: {
    flex: 1,
    paddingHorizontal: 24, // Matched header
  },
  overlapSection: {
    marginTop: -60, // OVERLAPS THE HEADER
    zIndex: 20,
    paddingBottom: 40,
  },
  cardStripPrimary: {
    width: 3, // Highly disciplined 3px hierarchy weight
  },
  cardsGrid: {
    gap: 8, // Strict 8pt spacing
  },

  /* ─── CARDS BASE ─── */
  cardBase: {
    height: CARD_HEIGHT,
    borderRadius: 20,
    width: "100%",
  },
  cardPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
  },
  cardStrip: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  cardTextCol: {
    flex: 1,
    paddingHorizontal: 14,
    gap: 2,
  },
  chevronBox: {
    width: 32, height: 32,
    borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },

  /* ─── INVERTED CARD (Student Hero) ─── */
  cardInverted: {
    backgroundColor: PALETTE.surfaceInverted,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    height: CARD_HEIGHT, // Height standardized
  },
  cardShadowPrimary: {
    ...Platform.select({
      ios: { shadowColor: PALETTE.surfaceInverted, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 24 },
      android: { elevation: 2 },
    }),
  },
  cardIconBoxInverted: {
    width: 48, height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
    marginLeft: 6,
  },
  cardTitleInverted: {
    fontSize: 16, fontWeight: "800", color: "#FFFFFF",
  },
  cardSubInverted: {
    fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.4)",
  },

  /* ─── LIGHT CARD (Secondary) ─── */
  cardLight: {
    backgroundColor: PALETTE.surfaceCard,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.04)",
  },
  cardShadowLight: {
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 12 },
      android: { elevation: 1 },
    }),
  },
  cardIconBoxLight: {
    width: 44, height: 44,
    borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    marginLeft: 6,
  },
  cardTitleLight: {
    fontSize: 15, fontWeight: "700", color: PALETTE.inkDark,
  },
  cardSubLight: {
    fontSize: 12, fontWeight: "500", color: PALETTE.inkWhiteMuted,
  },

  /* ─── FOOTER ─── */
  footerSection: {
    alignItems: "center",
    marginTop: 56, // 8pt rigorous containment ( increased for breathing room )
    gap: 6,
  },
  footerDivider: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginBottom: 6,
  },
  footerBrand: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "rgba(100,116,139,0.4)", // Alpha 0.4 system text
    letterSpacing: 3.5, // Widened tracking
  },
  footerVersion: {
    fontSize: 9.5,
    fontWeight: "500",
    color: "rgba(148,163,184,0.5)",
    letterSpacing: 0.5,
  }
});
