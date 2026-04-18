import { Sizing } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

export const welcomeSectionStyles = StyleSheet.create({
  outer: {
    marginBottom: Sizing.padding.m,
    overflow: 'visible',
  },
  card: {
    overflow: 'hidden',
  },
  cardInner: {
    paddingHorizontal: Sizing.padding.l + 4,
    paddingVertical: Sizing.padding.l + 6,
  },
  greeting: {
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  userNickname: {
    fontSize: 15,
    marginTop: 6,
    fontWeight: '500',
    opacity: 0.9,
  },
  orgLine: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  bio: {
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20,
  },
  hint: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
    opacity: 0.85,
  },
});
