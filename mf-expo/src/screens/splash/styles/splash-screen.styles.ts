import { Platform, StyleSheet } from 'react-native';
import { Sizing } from 'masterfabric-expo-core';

export const splashScreenStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Sizing.padding.xl,
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 28,
  },
  appName: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  versionRow: {
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 6,
    opacity: 0.85,
  },
  envBadge: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 14,
    opacity: 0.55,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.55,
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: Sizing.padding.xl,
    paddingBottom: Platform.OS === 'ios' ? 28 : 24,
    alignItems: 'center',
    gap: 12,
  },
  status: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.5,
    lineHeight: 18,
  },
});
