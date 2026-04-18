import type { ThemeColors } from 'masterfabric-expo-core';

/**
 * Consistent TextInput theming for sheets/modals (placeholder, caret, selection, keyboard).
 */
export function themedTextInputProps(colors: ThemeColors, isDark: boolean) {
  return {
    placeholderTextColor: colors.labelText,
    selectionColor: colors.tint,
    cursorColor: colors.tint,
    underlineColorAndroid: 'transparent' as const,
    keyboardAppearance: (isDark ? 'dark' : 'light') as 'dark' | 'light',
  };
}
