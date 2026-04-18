import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedSurface } from '@/src/shared/components/ui/ThemedSurface';
import { BRAND_RADIUS, brandPanelOutline } from './brand-theme';

export interface BrandPanelProps {
  isDark: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Bordered elevated panel — onboarding skip chip, hero cards. */
export function BrandPanel({ isDark, children, style, contentStyle }: BrandPanelProps) {
  return (
    <View
      style={[
        styles.wrap,
        {
          borderRadius: BRAND_RADIUS.panel,
          overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
        },
        brandPanelOutline(isDark),
        style,
      ]}
    >
      <ThemedSurface variant="surface" style={StyleSheet.absoluteFill} />
      <View style={[styles.inner, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  inner: {
    padding: 20,
  },
});
