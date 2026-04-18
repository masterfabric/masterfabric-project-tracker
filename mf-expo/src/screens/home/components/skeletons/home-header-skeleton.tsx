import { useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { homeHeaderStyles } from '../../styles/home-header.styles';

export function HomeHeaderSkeleton() {
  const { isDark, colors } = useTheme();

  return (
    <View
      style={[
        homeHeaderStyles.shell,
        {
          backgroundColor: colors.headerBackground,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.headerBorder,
        },
      ]}
    >
      <View style={homeHeaderStyles.row}>
      {/* Logo skeleton */}
      <View style={styles.logoContainer}>
        <View
          style={[
            styles.logoSkeleton,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.05)',
            },
          ]}
        />
      </View>

      {/* Actions skeleton */}
      <View style={styles.actionsContainer}>
        <View
          style={[
            styles.actionButtonSkeleton,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.05)',
            },
          ]}
        />
        <View
          style={[
            styles.actionButtonSkeleton,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.05)',
            },
          ]}
        />
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    flex: 1,
  },
  logoSkeleton: {
    width: 120,
    height: 32,
    borderRadius: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButtonSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});

