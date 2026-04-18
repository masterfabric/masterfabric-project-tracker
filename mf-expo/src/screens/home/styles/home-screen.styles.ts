import { Sizing } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

export const homeScreenStyles = StyleSheet.create({
  container: {
    flex: Sizing.flexNumber.full,
  },
  content: {
    flex: Sizing.flexNumber.full,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Sizing.padding.xxxl * 2,
  },
});
