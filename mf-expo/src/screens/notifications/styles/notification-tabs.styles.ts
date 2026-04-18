import { Sizing, typographyHelper } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

export const notificationTabsStyles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 7,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: Sizing.gap.s,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
    maxWidth: 200,
  },
  pillLabel: {
    ...typographyHelper.fromSizing.createStyle(Sizing, 's', 'semibold', 'normal'),
    maxWidth: 120,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 5,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
