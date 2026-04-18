import {
  SOFT_CARD_RADIUS,
  softSurfaceShadow,
} from '@/src/shared/ui/screen-card-styles';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { todosSectionStyles } from '../../styles/todos-section.styles';
import { TodosListSkeleton } from './todos-list-skeleton';

/** Matches loaded TodosSection: card shell, header + actions, description, draggable-style rows. */
export function TodosSectionSkeleton() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const skeletonBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)';
  const skeletonBgMuted = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  const sectionContainerStyle = useMemo(
    () => [
      todosSectionStyles.section,
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
        {/* Header: title + count badge | refresh + add */}
        <View style={todosSectionStyles.sectionHeader}>
          <View style={todosSectionStyles.titleRow}>
            <View style={[styles.titleSkeleton, { backgroundColor: skeletonBg }]} />
            <View style={[styles.countBadgeSkeleton, { backgroundColor: skeletonBgMuted }]} />
          </View>
          <View style={todosSectionStyles.actionsRow}>
            <View style={[styles.actionIconSkeleton, { backgroundColor: skeletonBg }]} />
            <View style={[styles.actionIconSkeleton, { backgroundColor: skeletonBg }]} />
          </View>
        </View>

        {/* Two-line description placeholder */}
        <View style={styles.descriptionBlock}>
          <View style={[styles.descriptionLine, { backgroundColor: skeletonBgMuted }]} />
          <View style={[styles.descriptionLineShort, { backgroundColor: skeletonBgMuted }]} />
        </View>

        <TodosListSkeleton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleSkeleton: {
    height: 20,
    width: 118,
    borderRadius: 6,
  },
  countBadgeSkeleton: {
    width: 48,
    height: 22,
    borderRadius: 8,
  },
  actionIconSkeleton: {
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
    width: '72%',
    borderRadius: 4,
  },
});
