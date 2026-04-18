import { Sizing } from 'masterfabric-expo-core';
import { StyleSheet, type TextStyle } from 'react-native';

export const onboardingSkipButtonTextStyle: TextStyle = {
  fontSize: 15,
  fontWeight: '500',
  letterSpacing: -0.1,
  lineHeight: 20,
};

export const onboardingScreenStyles = StyleSheet.create({
  root: {
    flex: Sizing.flexNumber.full,
  },
  column: {
    flex: Sizing.flexNumber.full,
  },
  container: {
    flex: 1,
  },
  safeTransparent: {
    backgroundColor: 'transparent',
  },
  skipRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Sizing.padding.l,
    paddingTop: Sizing.padding.xs,
  },
  skipHit: {
    paddingVertical: Sizing.padding.xs,
    paddingHorizontal: Sizing.padding.xs,
  },
  contentArea: {
    flex: Sizing.flexNumber.full,
  },
  flexFill: {
    flex: 1,
  },
  footer: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Sizing.padding.m,
    paddingHorizontal: Sizing.padding.xl,
    backgroundColor: 'transparent',
  },
});
