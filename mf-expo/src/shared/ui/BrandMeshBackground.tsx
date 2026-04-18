import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  brandChromeStyles,
  getBrandMeshAccentOrb,
  getBrandMeshGradient,
  tintHexToRgb,
} from './brand-theme';

export interface BrandMeshBackgroundProps {
  isDark: boolean;
  /** @deprecated Ignored — solid shell only */
  accentColor?: string;
  /** Override base fill when `variant` is `solid` only */
  backgroundColor?: string;
  /** `solid` = flat fill; `ambient` = soft gradient + brand orbs (onboarding) */
  variant?: 'solid' | 'ambient';
  /** Hex for orb tint, e.g. theme `onboardingColor` */
  meshAccentHex?: string;
}

/**
 * Full-screen backdrop: flat (`solid`) or soft gradient + accent orbs (`ambient`).
 */
export function BrandMeshBackground({
  isDark,
  backgroundColor,
  variant = 'solid',
  meshAccentHex = '#FF9500',
}: BrandMeshBackgroundProps) {
  const flatBg =
    backgroundColor ?? (isDark ? '#000000' : '#FFFFFF');

  if (variant === 'solid') {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: flatBg }]}
      />
    );
  }

  const [c0, c1, c2] = getBrandMeshGradient(isDark);
  const orbRgb = tintHexToRgb(meshAccentHex);
  const orbColor = getBrandMeshAccentOrb(isDark, orbRgb);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[c0, c1, c2]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[brandChromeStyles.orbTop, { backgroundColor: orbColor }]}
      />
      <View
        style={[
          brandChromeStyles.orbBottom,
          {
            backgroundColor: orbColor,
            opacity: isDark ? 0.75 : 0.55,
          },
        ]}
      />
    </View>
  );
}
