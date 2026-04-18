import { Sizing, typographyHelper } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

export const notificationItemStyles = StyleSheet.create({
  cardWrap: {
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardInnerWrap: {
    position: 'relative' as const,
  },
  editBtn: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  container: {
    paddingHorizontal: Sizing.padding.m,
    paddingVertical: Sizing.padding.m,
    position: 'relative',
    borderRadius: 18,
  },
  unreadContainer: {},
  content: {
    flexDirection: Sizing.layout.flexDirection.row,
    alignItems: Sizing.layout.alignItems.flexStart,
  },
  iconContainer: {
    marginRight: Sizing.padding.s,
    alignItems: Sizing.layout.alignItems.center,
    justifyContent: Sizing.layout.justifyContent.center,
    paddingTop: Sizing.spacing.xxs,
  },
  iconWrapper: {
    width: Sizing.icon.m,
    height: Sizing.icon.m,
    borderRadius: Sizing.icon.m / 2,
    alignItems: Sizing.layout.alignItems.center,
    justifyContent: Sizing.layout.justifyContent.center,
  },
  textContainer: {
    flex: Sizing.flexNumber.full,
    justifyContent: Sizing.layout.justifyContent.center,
  },
  header: {
    flexDirection: Sizing.layout.flexDirection.row,
    alignItems: Sizing.layout.alignItems.flexStart,
    justifyContent: Sizing.layout.justifyContent.spaceBetween,
    marginBottom: Sizing.spacing.xxs,
  },
  title: {
    ...typographyHelper.fromSizing.createStyle(Sizing, 'm', 'medium', 'normal'),
    flex: Sizing.flexNumber.full,
    marginRight: Sizing.padding.s,
  },
  unreadTitle: {
    fontWeight: '600',
  },
  unreadIndicator: {
    width: Sizing.gap.s,
    height: Sizing.gap.s,
    borderRadius: Sizing.spacing.xxs,
    marginTop: Sizing.padding.xxs,
  },
  priorityBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Sizing.spacing.xxs,
  },
  subtitle: {
    ...typographyHelper.fromSizing.createStyle(Sizing, 'xs', 'normal', 'normal'),
    marginBottom: Sizing.spacing.xxs,
    opacity: Sizing.opacity.l,
  },
  message: {
    ...typographyHelper.fromSizing.createStyle(Sizing, 's', 'normal', 'normal'),
    marginBottom: Sizing.padding.xs,
    opacity: Sizing.opacity.xl,
  },
  imageWrapper: {
    marginTop: Sizing.padding.xs,
    borderRadius: Sizing.gap.s,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 72,
    borderRadius: Sizing.gap.s,
  },
  footer: {
    flexDirection: Sizing.layout.flexDirection.row,
    alignItems: Sizing.layout.alignItems.center,
    justifyContent: Sizing.layout.justifyContent.spaceBetween,
  },
  metaContainer: {
    flexDirection: Sizing.layout.flexDirection.row,
    alignItems: Sizing.layout.alignItems.center,
  },
  timeIcon: {
    marginRight: Sizing.spacing.xxs,
    opacity: Sizing.opacity.l,
  },
  timestamp: {
    ...typographyHelper.fromSizing.createStyle(Sizing, 'xs', 'medium', 'normal'),
    opacity: Sizing.opacity.l,
  },
  categoryBadge: {
    flexDirection: Sizing.layout.flexDirection.row,
    alignItems: Sizing.layout.alignItems.center,
    paddingHorizontal: Sizing.gap.s,
    paddingVertical: Sizing.spacing.xxs,
    borderRadius: Sizing.gap.s,
  },
  categoryIcon: {
    marginRight: Sizing.spacing.xxs,
  },
  categoryText: {
    ...typographyHelper.fromSizing.createStyle(Sizing, 'xxs', 'semibold', 'normal'),
    textTransform: 'uppercase',
  },
  unreadLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: Sizing.spacing.xxs,
  },
  separator: {
    height: Sizing.divider.height.hairline,
    marginLeft: Sizing.icon.m + Sizing.padding.s + Sizing.padding.m, // Align with text content
  },
});
