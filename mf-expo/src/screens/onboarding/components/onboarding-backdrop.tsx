import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

type OnboardingBackdropProps = {
  isDark: boolean;
};

/**
 * Minimal gradient + soft ring pattern (decorative only).
 */
export function OnboardingBackdrop({ isDark }: OnboardingBackdropProps) {
  const { width: w, height: h } = useWindowDimensions();

  const stroke = isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.04)';
  const strokeSoft = isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.028)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={
          isDark
            ? ['#12121a', '#08080c', '#0e0e14']
            : ['#ffffff', '#f4f5f9', '#fafbfd']
        }
        locations={[0, 0.5, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ['transparent', 'rgba(0,0,0,0.5)']
            : ['transparent', 'rgba(0,0,0,0.035)']
        }
        start={{ x: 0.5, y: 0.25 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.85 : 1 }]}
      />

      <Ring size={w * 0.95} color={stroke} top={h * 0.06} left={w * 0.025} />
      <Ring size={w * 1.2} color={strokeSoft} top={h * 0.18} left={-w * 0.14} />
      <Ring size={w * 0.52} color={stroke} bottom={h * 0.14} right={-w * 0.06} />
      <Ring size={w * 0.68} color={strokeSoft} bottom={-w * 0.12} left={w * 0.16} />
      <Ring size={w * 0.38} color={strokeSoft} top={h * 0.42} right={-w * 0.04} />
    </View>
  );
}

function Ring({
  size,
  color,
  ...pos
}: {
  size: number;
  color: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: color,
        },
        pos,
      ]}
    />
  );
}
