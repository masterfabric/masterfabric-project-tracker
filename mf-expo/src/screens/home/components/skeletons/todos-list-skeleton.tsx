import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { todosSectionStyles } from '../../styles/todos-section.styles';

const ROW_COUNT = 4;

/** Placeholder list + expand control while todos load (card chrome stays real). */
export function TodosListSkeleton() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const skeletonBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)';
  const skeletonBgMuted = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  const rowShellStyle = useMemo(
    () => ({
      backgroundColor: isDark ? colors.background + 'AA' : '#fff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder + '70',
    }),
    [isDark, colors.background, colors.surfaceBorder]
  );

  return (
    <>
      <View style={todosSectionStyles.list}>
        {Array.from({ length: ROW_COUNT }, (_, index) => (
          <View
            key={index}
            style={[todosSectionStyles.todoItem, rowShellStyle]}
          >
            <View style={[styles.checkboxSkeleton, { backgroundColor: skeletonBg }]} />
            <View style={[todosSectionStyles.emojiPrefix, { backgroundColor: skeletonBgMuted }]} />
            <View style={todosSectionStyles.todoItemContent}>
              <View
                style={[
                  styles.titleLineSkeleton,
                  { backgroundColor: skeletonBg },
                  index === ROW_COUNT - 1 && styles.titleLineShort,
                ]}
              />
              {index % 2 === 0 ? (
                <View style={[styles.metaLineSkeleton, { backgroundColor: skeletonBgMuted }]} />
              ) : null}
            </View>
            <View style={todosSectionStyles.dragHandle}>
              <View style={[styles.handleSkeleton, { backgroundColor: skeletonBg }]} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.expandSkeleton}>
        <View style={[styles.expandChevronSkeleton, { backgroundColor: skeletonBg }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  checkboxSkeleton: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  handleSkeleton: {
    width: 22,
    height: 22,
    borderRadius: 5,
  },
  titleLineSkeleton: {
    height: 15,
    width: '78%',
    borderRadius: 4,
  },
  titleLineShort: {
    width: '42%',
  },
  metaLineSkeleton: {
    height: 11,
    width: '58%',
    borderRadius: 3,
    marginTop: 4,
  },
  expandSkeleton: {
    alignSelf: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  expandChevronSkeleton: {
    width: 32,
    height: 10,
    borderRadius: 5,
  },
});
