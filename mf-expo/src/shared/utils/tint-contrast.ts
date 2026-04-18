import { accentLight } from 'masterfabric-expo-core';

/**
 * Text/icon color on top of `colors.tint` fills.
 * Light theme: tint is dark → use white.
 * Dark theme: tint is light (accentDark) → use dark charcoal.
 */
export function foregroundOnTint(isDark: boolean): string {
  return isDark ? accentLight : '#FFFFFF';
}
