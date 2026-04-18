import { Platform, StyleSheet } from 'react-native';
import { Sizing } from 'masterfabric-expo-core';

// iOS-style grouped settings
const SECTION_INSET = 20;
const ROW_RADIUS = 10;
const ROW_HEIGHT = 44;

export const settingsStyles = StyleSheet.create({
  container: {
    flex: Sizing.flexNumber.full,
  },
  content: {
    flex: Sizing.flexNumber.full,
  },
  contentContainer: {
    paddingHorizontal: SECTION_INSET,
    paddingTop: 24,
    paddingBottom: Sizing.padding.xxl,
  },
  // Section header (iOS small caps style)
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 8,
    marginTop: 24,
    paddingHorizontal: 4,
  },
  sectionHeaderFirst: {
    marginTop: 0,
  },
  // Grouped inset container
  groupedSection: {
    borderRadius: ROW_RADIUS,
    overflow: 'hidden',
  },
  // Single row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ROW_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowWithSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '400',
  },
  rowValue: {
    fontSize: 17,
    fontWeight: '400',
  },
  rowChevron: {
    marginLeft: 8,
  },
  // Logout row (destructive)
  logoutRow: {
    marginTop: 24,
  },
});
