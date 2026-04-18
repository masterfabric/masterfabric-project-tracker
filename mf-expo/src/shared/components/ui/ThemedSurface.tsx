import { getThemeColors, useMasterView } from 'masterfabric-expo-core';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type ThemedSurfaceVariant = 'header' | 'tabBar' | 'surface';

export interface ThemedSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: ThemedSurfaceVariant;
}

export function ThemedSurface({ children, style, variant = 'header' }: ThemedSurfaceProps) {
  const { isDark } = useMasterView();
  const colors = getThemeColors(isDark);
  const backgroundColor =
    variant === 'tabBar'
      ? colors.tabBarBackground
      : variant === 'surface'
        ? colors.surfaceBackground
        : colors.headerBackground;

  return (
    <View style={[styles.base, { backgroundColor }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
