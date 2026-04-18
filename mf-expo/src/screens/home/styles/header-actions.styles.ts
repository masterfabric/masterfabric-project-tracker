import { Sizing } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

export const headerActionsStyles = StyleSheet.create({
  container: {
    flexDirection: Sizing.layout.flexDirection.row,
    alignItems: Sizing.layout.alignItems.center,
    gap: Sizing.gap.m,
  },
  iconButton: {
    width: Sizing.icon.xl + 2,
    height: Sizing.icon.xl + 2,
    borderRadius: (Sizing.icon.xl + 2) / 2,
    justifyContent: Sizing.layout.justifyContent.center,
    alignItems: Sizing.layout.alignItems.center,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  profileCircle: {
    overflow: 'hidden',
    borderWidth: Sizing.borderWidth.s,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    fontSize: 12,
    fontWeight: '600',
  },
});
