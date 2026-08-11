/**
 * Global School Configuration
 * Edit this file to change the school branding across the entire app.
 *
 * This configuration is used in:
 * - App Headers (Admin, Staff, Student)
 * - Login/Logout Screens
 * - Report Cards & Certificates
 * - PDF Generation
 * - App-wide theming (colors, typography, spacing, shapes)
 */

import type { SchoolTheme } from '../theme/types';
import { defaultDarkTheme, defaultLightTheme } from '../theme/types';

/**
 * Build `rgba(...)` from `#RRGGBB` / `#RGB` for ribbon overlays and dividers.
 *
 * Marked as a Reanimated worklet so it can be called from inside `useAnimatedStyle`
 * on the UI thread (the scroll-driven dashboard headers do this). Reanimated 4 throws
 * a hard "tried to synchronously call a non-worklet function on the UI thread" error
 * otherwise, which blanks every dashboard after login. It remains a normal function
 * when called from the JS thread (PDFs, welcome screen, ribbon, etc.).
 */
export function schoolColorWithAlpha(hex: string | undefined | null, alpha: number): string {
  'worklet';
  if (hex == null || typeof hex !== 'string') {
    return `rgba(212,175,55,${alpha})`;
  }
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return `rgba(212,175,55,${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * App-wide theme configuration.
 * This is the SINGLE SOURCE OF TRUTH for all visual styling.
 * 
 * To customize your school's appearance, modify the values below.
 * The app will automatically use these values throughout all screens and components.
 * 
 * Both light and dark themes are defined here. The app respects user preference.
 */
export const schoolTheme: { light: SchoolTheme; dark: SchoolTheme } = {
  light: {
    ...defaultLightTheme,
    colors: {
      ...defaultLightTheme.colors,
      // Primary brand color – Royal Indigo (logo outer ring)
      primary: '#3535A8',
      primaryLight: '#0082C8',   // Cerulean Blue (logo book & center figure)
      primaryDark: '#282889',    // Deep Indigo (ring darker areas)
      // Secondary color – Vibrant Orange (logo side figures)
      secondary: '#F26522',
      // Accent color – Bright Yellow/Gold (logo ring text)
      accent: '#FFE600',
      // Backgrounds – cool blue-tinted neutrals
      background: '#F8FAFC',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      // Text colors – indigo palette
      textPrimary: '#3535A8',
      textStrong: '#282889',
      textSecondary: '#475569',
      textMuted: '#64748B',
      text: '#3535A8',
      textTertiary: '#64748B',
      // Borders – indigo-tinted
      border: '#E2E8F0',
      borderLight: '#F1F5F9',
      // Semantic colors
      danger: '#D32F2F',
      success: '#10B981',
      warning: '#F59E0B',
      info: '#0082C8',           // Cerulean Blue
      notification: '#F26522',
      // Navigation – indigo pill tints
      navPill: '#E0E7FF',
      navIconActive: '#3535A8',
      navIconInactive: '#64748B',
      // Header/Footer backgrounds (with transparency for glass effect)
      headerBg: 'rgba(248,250,252, 0.88)',
      footerBg: 'rgba(255,255,255, 0.92)',
      // Alert colors
      alertBg: '#EEEDFA',        // Light indigo wash
      alertBorder: '#C7C7F0',    // Indigo border tint
      alertIcon: '#3535A8',
      alertText: '#282889',
      alertBgDanger: '#FEF2F2',
      alertBorderDanger: '#FECACA',
      alertIconDanger: '#D32F2F',
      alertTextDanger: '#991B1B',
      alertBgInfo: '#E6F4FE',    // Cerulean blue wash
      alertBorderInfo: '#B3DDFB',
      alertIconInfo: '#0082C8',
      alertTextInfo: '#282889',
    },
    typography: {
      fontFamily: 'System',
      fontFamilyBold: 'System',
      fontSizeXS: 11,
      fontSizeSM: 13,
      fontSizeMD: 15,
      fontSizeLG: 17,
      fontSizeXL: 20,
      fontSizeXXL: 24,
      fontSizeXXXL: 28,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    },
    shape: {
      borderRadiusXS: 6,
      borderRadiusSM: 8,
      borderRadiusMD: 12,
      borderRadiusLG: 16,
      borderRadiusXL: 20,
      borderRadiusFull: 9999,
    },
    shadows: {
      none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
      sm: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
      },
      md: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 6,
      },
      lg: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
      },
    },
  },
  dark: {
    ...defaultDarkTheme,
    colors: {
      ...defaultDarkTheme.colors,
      // Primary – lighter indigo for dark mode legibility
      primary: '#9595E0',       // Lightened Royal Indigo
      primaryLight: '#C7D2FE',
      primaryDark: '#3535A8',   // Royal Indigo (full strength)
      // Secondary – light orange for dark mode
      secondary: '#FFA066',
      // Accent – bright yellow
      accent: '#FFE600',
      // Dark backgrounds – deep dark slate/indigo tones
      background: '#0F1228',    // Very dark indigo-tinted
      surface: '#1C1E38',       // Dark indigo surface
      card: '#1C1E38',
      // Light text for dark backgrounds
      textPrimary: '#F1F5F9',
      textStrong: '#FFFFFF',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      text: '#F1F5F9',
      textTertiary: '#64748B',
      // Darker borders – indigo-tinted slate
      border: '#2E3052',
      borderLight: '#3D4068',
      // Lighter semantic colors for dark mode
      danger: '#F87171',
      success: '#34D399',
      warning: '#FBBF24',
      info: '#5CC4F0',          // Light cerulean
      notification: '#FFA066',
      // Navigation – indigo tint
      navPill: 'rgba(53, 53, 168, 0.2)',
      navIconActive: '#C7D2FE',
      navIconInactive: '#94A3B8',
      // Header/Footer with dark indigo glass effect
      headerBg: 'rgba(15, 18, 40, 0.88)',
      footerBg: 'rgba(28, 30, 56, 0.92)',
      // Alert colors (dark mode)
      alertBg: 'rgba(53, 53, 168, 0.12)',
      alertBorder: 'rgba(53, 53, 168, 0.25)',
      alertIcon: '#C7D2FE',
      alertText: '#C7D2FE',
      alertBgDanger: 'rgba(248,113,113, 0.1)',
      alertBorderDanger: 'rgba(248,113,113, 0.2)',
      alertIconDanger: '#F87171',
      alertTextDanger: '#FECACA',
      alertBgInfo: 'rgba(0, 130, 200, 0.15)',
      alertBorderInfo: 'rgba(0, 130, 200, 0.3)',
      alertIconInfo: '#5CC4F0',
      alertTextInfo: '#B3DDFB',
    },
    typography: {
      fontFamily: 'System',
      fontFamilyBold: 'System',
      fontSizeXS: 11,
      fontSizeSM: 13,
      fontSizeMD: 15,
      fontSizeLG: 17,
      fontSizeXL: 20,
      fontSizeXXL: 24,
      fontSizeXXXL: 28,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    },
    shape: {
      borderRadiusXS: 6,
      borderRadiusSM: 8,
      borderRadiusMD: 12,
      borderRadiusLG: 16,
      borderRadiusXL: 20,
      borderRadiusFull: 9999,
    },
    shadows: {
      none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
      sm: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      },
      md: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
      },
      lg: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
      },
    },
  },
};

export const SCHOOL_CONFIG = {
  // The official name of the school displayed in headers and reports
  name: "Bhashyam Vidyanikethan Mohammadabad",

  // Short line under the school name on the header ribbon (gold text)
  tagline: "Education with Moral Values",

  // Motto / core values shown in the first info column of the ribbon (letterhead)
  motto: "Care and Achieve through Quality Education and Discipline",

  // The school logo used in headers and reports
  // Ensure the image exists in assets/images/
  logo: require('../../assets/images/icon.png'),

  // Optional: School Address for reports
  address: "Bhashyam Vidyanikethan School,VenkatReddypally Road, Mohammadabad,Mahabubnagar District, Telangana-509337",

  // Optional: Contact info for reports
  contact: "9966868389",

  // Optional: School email for letterhead / reports
  email: "bhashyamvidyanikethan@gmail.com",

  // Website or Email
  website: "www.nexsyrus.com",

  websiteGallery: {
    enabled: false,
    unavailableTitle: 'Build Your School Website',
    unavailableMessage: 'You need to build a website first. Contact Nexsyrus to Build Your Own Website.',
    contactUrl: 'https://api.whatsapp.com/send?phone=917892654731&text=Hi%2C%20I%20want%20to%20build%20a%20website%20for%20my%20school.',
  },

  // CBSE Affiliation No (if applicable)
  cbseAffiliationNo: "NA",

  // School Code (if applicable)
  schoolCode: "BVS",

  /**
   * Full recognition / affiliation sentence for certificates & PDFs.
   * Leave blank to show only `recognitionNo` as "RC No. …", or both combined.
   */
  recognitionLine: "",

  recognitionNo: "",

  /**
   * Colour theme for ribbon / letterhead chrome (SchoolRibbon, etc.).
   * Extracted from the logo: rich navy/royal blue with bright yellow accents.
   */
  theme: {
    /** Bright golden yellow dividers and trim (logo ring text) */
    accent: '#FFE600',
    /** Tagline text – bright gold/yellow */
    ribbonTagline: '#FFE600',
    /** Four-stop diagonal ribbon – deep indigo to royal blue gradient (extracted from logo ring) */
    ribbonGradient: ['#282889', '#3535A8', '#3D4FC0', '#4B64D4'] as const,
    /** Optional stops for expo-linear-gradient (length must match ribbonGradient) */
    ribbonGradientLocations: [0, 0.30, 0.65, 1] as const,
    /** Main title on the ribbon */
    ribbonTitle: '#FFFFFF',
    /** Scrolling marquee dot separator */
    marqueeSeparator: 'rgba(255,255,255,0.85)',
    /** Letterhead / info column body */
    ribbonBody: 'rgba(255,255,255,0.92)',
    ribbonBodyMuted: 'rgba(255,255,255,0.9)',
    /**
     * Icons over the ribbon / unsafe area (`expo-status-bar`).
     * Use `light` on dark gradients, `dark` if you switch to a light ribbon.
     */
    statusBarOnRibbon: 'light' as 'light' | 'dark',
  },
};

/** True when a config value is blank or a placeholder like NA / nil. */
function isBlankOfficialConfig(v?: string | null): boolean {
  const t = String(v ?? '').trim();
  if (!t) return true;
  return /^(n\/?a|na|nil|null|none|undefined|-|—|\.{2,}|_{2,})$/i.test(t);
}

/**
 * Combined recognition line for certificates / PDFs.
 * Built from `SCHOOL_CONFIG.recognitionLine` + optional `recognitionNo` (RC No.).
 * Empty when neither is configured — callers must hide the UI, not show "NA".
 */
export const SCHOOL_RECOGNITION_LINE = (() => {
  const line = String(SCHOOL_CONFIG.recognitionLine ?? '').trim();
  const rc = String(SCHOOL_CONFIG.recognitionNo ?? '').trim();
  const hasLine = !isBlankOfficialConfig(line);
  const hasRc = !isBlankOfficialConfig(rc);
  if (!hasLine && !hasRc) return '';
  if (hasLine && hasRc) {
    if (/rc\s*no\.?/i.test(line)) return line;
    return `${line.replace(/\s*,?\s*$/, '')}, RC No. ${rc}`;
  }
  if (hasLine) return line;
  return `RC No. ${rc}`;
})();
