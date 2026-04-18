import { Platform, StyleSheet } from 'react-native';

/** Large, friendly corners — use everywhere for cards. */
export const SOFT_CARD_RADIUS = 20;

/** Legacy alias */
export const SCREEN_CARD_RADIUS = SOFT_CARD_RADIUS;

/**
 * Soft elevation: gentle shadow (not harsh “floating” cards).
 */
export function cardShadowStyle(isDark: boolean) {
  if (isDark) {
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: Platform.OS === 'android' ? 2 : 0,
    } as const;
  }
  return {
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 28,
    elevation: Platform.OS === 'android' ? 1 : 0,
  } as const;
}

/** Almost flat — section on same plane, tiny lift (todos, lists). */
export function softSurfaceShadow(isDark: boolean) {
  if (isDark) {
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 0,
    } as const;
  }
  return {
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 16,
    elevation: 0,
  } as const;
}

export const screenCardStyles = StyleSheet.create({
  wrap: {
    borderRadius: SOFT_CARD_RADIUS,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
});
