import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { organizationNewsSectionStyles } from '../../styles/organization-news-section.styles';

const ROW_COUNT = 3;

/** Placeholder rows for OrganizationNewsSection while the feed loads (card chrome stays real). */
export function OrganizationNewsListSkeleton() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const skeletonBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)';
  const skeletonBgMuted = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  const rowShellStyle = useMemo(
    () => ({
      backgroundColor: isDark ? colors.background + 'AA' : '#fff',
    }),
    [isDark, colors.background]
  );

  return (
    <View style={organizationNewsSectionStyles.list}>
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <View
          key={index}
          style={[organizationNewsSectionStyles.row, rowShellStyle]}
        >
          <View style={organizationNewsSectionStyles.rowLead}>
            <View
              style={[
                organizationNewsSectionStyles.rowThumbnail,
                { backgroundColor: skeletonBgMuted },
              ]}
            />
          </View>
          <View style={organizationNewsSectionStyles.rowBody}>
            <View
              style={[
                styles.titleLineSkeleton,
                { backgroundColor: skeletonBg },
                index === ROW_COUNT - 1 && styles.titleLineShort,
              ]}
            />
            <View style={[styles.badgeLineSkeleton, { backgroundColor: skeletonBgMuted }]} />
            <View style={[styles.descLineSkeleton, { backgroundColor: skeletonBgMuted }]} />
            <View style={[styles.descLineSkeleton, styles.descLineShort, { backgroundColor: skeletonBgMuted }]} />
            <View style={[styles.metaLineSkeleton, { backgroundColor: skeletonBgMuted }]} />
          </View>
          <View style={[styles.chevronSkeleton, { backgroundColor: skeletonBg }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  titleLineSkeleton: {
    height: 16,
    width: '88%',
    borderRadius: 4,
  },
  titleLineShort: {
    width: '62%',
  },
  badgeLineSkeleton: {
    height: 12,
    width: '42%',
    borderRadius: 3,
    marginTop: 6,
  },
  descLineSkeleton: {
    height: 13,
    width: '100%',
    borderRadius: 4,
    marginTop: 6,
  },
  descLineShort: {
    width: '70%',
  },
  metaLineSkeleton: {
    height: 11,
    width: '48%',
    borderRadius: 3,
    marginTop: 8,
  },
  chevronSkeleton: {
    width: 18,
    height: 18,
    borderRadius: 4,
    marginTop: 2,
  },
});
