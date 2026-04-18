import {
  SOFT_CARD_RADIUS,
  softSurfaceShadow,
} from '@/src/shared/ui/screen-card-styles';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { organizationNewsSectionStyles } from '../../styles/organization-news-section.styles';
import { OrganizationNewsListSkeleton } from './organization-news-list-skeleton';

/** Full card placeholder (home initial load) — matches OrganizationNewsSection layout. */
export function OrganizationNewsSectionSkeleton() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const skeletonBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)';
  const skeletonBgMuted = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  const sectionContainerStyle = useMemo(
    () => [
      organizationNewsSectionStyles.section,
      { borderRadius: SOFT_CARD_RADIUS, overflow: 'visible' as const },
      softSurfaceShadow(isDark),
    ],
    [isDark]
  );

  const cardInnerStyle = useMemo(
    () => ({
      borderRadius: SOFT_CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surfaceBackground,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 14,
      overflow: 'visible' as const,
    }),
    [colors.surfaceBorder, colors.surfaceBackground]
  );

  return (
    <View style={sectionContainerStyle}>
      <View style={cardInnerStyle}>
        <View style={organizationNewsSectionStyles.sectionHeader}>
          <View style={organizationNewsSectionStyles.titleRow}>
            <View style={[styles.headerIconSkeleton, { backgroundColor: skeletonBg }]} />
            <View style={[styles.sectionTitleSkeleton, { backgroundColor: skeletonBg }]} />
          </View>
          <View style={[styles.refreshIconSkeleton, { backgroundColor: skeletonBg }]} />
        </View>

        <View style={styles.descriptionBlock}>
          <View style={[styles.descriptionLine, { backgroundColor: skeletonBgMuted }]} />
          <View style={[styles.descriptionLineShort, { backgroundColor: skeletonBgMuted }]} />
        </View>

        <OrganizationNewsListSkeleton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconSkeleton: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  sectionTitleSkeleton: {
    height: 20,
    width: 160,
    borderRadius: 6,
    flex: 1,
    maxWidth: 200,
  },
  refreshIconSkeleton: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  descriptionBlock: {
    marginBottom: 10,
    gap: 6,
  },
  descriptionLine: {
    height: 13,
    width: '100%',
    borderRadius: 4,
  },
  descriptionLineShort: {
    height: 13,
    width: '78%',
    borderRadius: 4,
  },
});
