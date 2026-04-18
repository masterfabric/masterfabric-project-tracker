import { useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { View, StyleSheet } from 'react-native';

export function NotificationSkeleton() {
  const { isDark, colors } = useTheme();

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((index) => (
        <View
          key={index}
          style={[
            styles.skeletonItem,
            {
              backgroundColor: colors.surfaceBackground,
              borderColor: colors.surfaceBorder + '30',
            },
          ]}
        >
          {/* Icon skeleton */}
          <View
            style={[
              styles.iconSkeleton,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.05)',
              },
            ]}
          />

          {/* Content skeleton */}
          <View style={styles.contentContainer}>
            {/* Title skeleton */}
            <View
              style={[
                styles.titleSkeleton,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            />

            {/* Message skeleton */}
            <View
              style={[
                styles.messageSkeleton,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.04)',
                },
              ]}
            />
            <View
              style={[
                styles.messageSkeleton,
                styles.messageSkeletonShort,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.04)',
                },
              ]}
            />

            {/* Time skeleton */}
            <View
              style={[
                styles.timeSkeleton,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.03)',
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    gap: 8,
  },
  skeletonItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  iconSkeleton: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  contentContainer: {
    flex: 1,
    gap: 6,
  },
  titleSkeleton: {
    height: 14,
    width: '70%',
    borderRadius: 4,
  },
  messageSkeleton: {
    height: 10,
    width: '100%',
    borderRadius: 4,
  },
  messageSkeletonShort: {
    width: '85%',
  },
  timeSkeleton: {
    height: 8,
    width: '30%',
    borderRadius: 4,
    marginTop: 2,
  },
});

