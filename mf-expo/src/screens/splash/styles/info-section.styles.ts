import { Sizing } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

export const infoSectionStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Sizing.gap.s,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.9,
    textAlign: 'center',
  },
});
