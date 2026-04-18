import { Sizing, typographyHelper } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

const getTypographyStyle = (fontSize: string, fontWeight: string, lineHeight: string = 'normal') => 
  (typographyHelper as any).fromSizing?.createStyle(Sizing, fontSize, fontWeight, lineHeight) || {};

export const headerLogoSectionStyles = StyleSheet.create({
  leftSection: {
    flex: 1,
    minWidth: 0,
    flexDirection: Sizing.layout.flexDirection.row,
    alignItems: Sizing.layout.alignItems.center,
  },
  titleColumn: {
    flexDirection: Sizing.layout.flexDirection.column,
    alignItems: Sizing.layout.alignItems.flexStart,
    maxWidth: '100%',
  },
  logo: {
    width: Sizing.icon.m,
    height: Sizing.icon.m,
  },
  textContainer: {
    marginLeft: Sizing.padding.s,
  },
  titleRow: {
    flexDirection: Sizing.layout.flexDirection.row,
    alignItems: Sizing.layout.alignItems.center,
    gap: Sizing.gap.s,
  },
  appName: {
    ...getTypographyStyle('l', 'semibold', 'normal'),
  },
  headerSubtitle: {
    ...getTypographyStyle('xs', 'normal', 'normal'),
    marginTop: Sizing.spacing.xxs,
  },
  divider: {
    ...Sizing.divider.hidden,
  },
  typewriterText: {
    fontFamily: 'Courier New',
    ...getTypographyStyle('xs', 'normal', 'normal'),
    opacity: Sizing.opacity.l,
    marginTop: Sizing.spacing.xxs,
  },
  cursor: {
    fontFamily: 'Courier New',
    opacity: Sizing.opacity.full,
  },
});
