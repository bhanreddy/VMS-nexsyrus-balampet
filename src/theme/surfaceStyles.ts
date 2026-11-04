import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useFlatSurface } from '../contexts/SurfaceAppearanceContext';
import { useTheme } from '../hooks/useTheme';
import { clay, clayCard, clayInset } from './clayStyles';
import { schoolColorWithAlpha } from '../constants/schoolConfig';

export const NO_DEPTH = {
  boxShadow: 'none', shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0, shadowRadius: 0, elevation: 0,
} as const;

export const flatCard = (isDark: boolean, _size?: 'sm' | 'md' | 'lg') => ({
  backgroundColor: isDark ? '#151D2D' : '#FFFFFF',
  borderColor: isDark ? '#293449' : '#EAECF2', borderWidth: 1, borderRadius: 16,
  ...NO_DEPTH,
});
export const flatInset = (isDark: boolean, focused = false) => ({
  backgroundColor: isDark ? '#1D273A' : '#F8F9FC',
  borderColor: focused ? '#4F46E5' : isDark ? '#293449' : '#EAECF2', borderWidth: 1,
  ...NO_DEPTH,
});

type AccentMaterial = (isDark: boolean, accent?: string) => object;
export function useSurfaceMaterials(fallbacks?: { puck?: AccentMaterial; row?: AccentMaterial; softInset?: (isDark: boolean) => object }) {
  const flat = useFlatSurface();
  const { theme } = useTheme();
  const accentSurface: AccentMaterial = (isDark, accent) => ({
    ...flatCard(isDark),
    ...(accent ? { backgroundColor: schoolColorWithAlpha(accent, isDark ? 0.18 : 0.08), borderColor: schoolColorWithAlpha(accent, 0.22) } : {}),
  });
  return {
    flat,
    raised: flat ? () => NO_DEPTH : clay,
    card: flat ? flatCard : clayCard,
    inset: flat ? flatInset : clayInset,
    puck: flat ? accentSurface : fallbacks?.puck || (() => ({})),
    row: flat ? accentSurface : fallbacks?.row || (() => ({})),
    softInset: flat ? () => ({ ...NO_DEPTH, backgroundColor: theme.colors.border }) : fallbacks?.softInset || (() => ({})),
  };
}

/** Remove tactile treatments from shared screens only within the flat portal. */
export function useSurfaceStyleMap<T extends Record<string, any>>(base: T): T {
  const flat = useFlatSurface();
  const { theme } = useTheme();
  return useMemo(() => !flat ? base : Object.fromEntries(Object.entries(base).map(([key, value]) => [key, {
    ...StyleSheet.flatten(value), ...NO_DEPTH, backgroundImage: 'none',
    textShadow: 'none', textShadowColor: 'transparent', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0,
    ...(/^(sheet|sheetOuter|card|profileCard)$/.test(key) ? { backgroundColor: theme.colors.card, borderColor: theme.colors.border } : {}),
    ...(/sheen|gloss|blob|keyLight/i.test(key) ? { opacity: 0 } : {}),
  }])) as T, [base, flat, theme]);
}
