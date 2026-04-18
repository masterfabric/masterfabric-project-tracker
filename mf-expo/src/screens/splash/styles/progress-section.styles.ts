import { Sizing } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

export const progressSectionStyles = StyleSheet.create({
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Sizing.gap.s,
    marginBottom: Sizing.padding.xl,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
