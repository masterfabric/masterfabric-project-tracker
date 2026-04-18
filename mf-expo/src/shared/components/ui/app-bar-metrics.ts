import { Platform, StyleSheet } from 'react-native';

export function appBarBottomHairline(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';
}

export const appBarShellStyle = {
  position: 'relative' as const,
  overflow: 'hidden' as const,
};

export function appBarHairlineOverlayStyle(borderColor: string) {
  return {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: borderColor,
  };
}

/** Optional soft lift under app bar (iOS). */
export function appBarAmbientShadow(isDark: boolean) {
  if (Platform.OS === 'android') return {};
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.22 : 0.06,
    shadowRadius: 10,
  };
}
