/**
 * Single brand surface language for splash, onboarding, marketing-adjacent flows,
 * and any screen that should feel “product” rather than one-off.
 *
 * Pair with:
 * - BrandMeshBackground (full-screen solid backdrop)
 * - BrandPanel / ThemedSurface for elevated blocks
 * - screen-card-styles (SOFT_CARD_RADIUS) for solid cards inside the shell
 */

import { Platform, StyleSheet, ViewStyle } from 'react-native';

import { SOFT_CARD_RADIUS } from './screen-card-styles';

export const BRAND_RADIUS = {
  /** Cards, onboarding panels, logo dock */
  panel: SOFT_CARD_RADIUS,
  /** Bottom sheets / control docks */
  dock: 28,
  /** Pills (skip, chips) */
  pill: 999,
} as const;

/** Mesh gradient stops — light: clean white / warm gray (no blue cast); dark: neutral deep grays */
export function getBrandMeshGradient(isDark: boolean): readonly [string, string, string] {
  if (isDark) {
    return ['#070709', '#0e0e12', '#09090c'] as const;
  }
  return ['#fbfbfe', '#f4f5f9', '#ffffff'] as const;
}

/** Secondary wash (overlay) for depth — very subtle */
export function getBrandMeshAccentOrb(isDark: boolean, tintRgb: string): string {
  // tintRgb like "59, 130, 246" from #3b82f6
  const opacity = isDark ? 0.12 : 0.18;
  return `rgba(${tintRgb}, ${opacity})`;
}

export function tintHexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r}, ${g}, ${b}`;
}

export const brandChromeStyles = StyleSheet.create({
  meshAbsolute: {
    ...StyleSheet.absoluteFillObject,
  },
  orbTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -80,
    right: -100,
  },
  orbBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    bottom: -60,
    left: -80,
  },
});

export function brandPanelOutline(isDark: boolean): ViewStyle {
  return {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.65)',
  };
}

export function brandDockShadow(isDark: boolean): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation: 12 };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: isDark ? 0.35 : 0.08,
    shadowRadius: 16,
  };
}
