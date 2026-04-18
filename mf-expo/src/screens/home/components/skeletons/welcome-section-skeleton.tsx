import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { welcomeSectionStyles } from '../../styles/welcome-section.styles';

export function WelcomeSectionSkeleton() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  return (
    <View style={welcomeSectionStyles.outer}>
      {/* User name skeleton */}
      <View
        style={[
          styles.userNameSkeleton,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(0, 0, 0, 0.03)',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  userNameSkeleton: {
    height: 18,
    width: '35%',
    borderRadius: 6,
  },
});

