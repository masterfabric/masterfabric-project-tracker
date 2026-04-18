import { Sizing } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

/** Minimal single column — no nested cards */
export const stepContentStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Sizing.padding.xl,
    paddingVertical: Sizing.padding.xl,
    paddingBottom: Sizing.padding.xxl,
  },
  column: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
  },
  icon: {
    marginBottom: Sizing.padding.l,
    opacity: 0.92,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.6,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: Sizing.gap.s,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: Sizing.gap.m,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: -0.1,
    opacity: 0.92,
  },
  belowFold: {
    marginTop: Sizing.padding.xl,
    alignItems: 'center',
  },
});
