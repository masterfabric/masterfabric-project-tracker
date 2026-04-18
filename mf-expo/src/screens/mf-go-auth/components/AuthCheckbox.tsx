import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { mfGoAuthStyles as styles } from '../styles/mf-go-auth.styles';

interface AuthCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
}

export function AuthCheckbox({ checked, onToggle, label, hint }: AuthCheckboxProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);

  return (
    <Pressable
      onPress={onToggle}
      style={styles.checkboxRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? colors.tint : 'transparent',
            borderColor: checked ? colors.tint : colors.surfaceBorder,
          },
        ]}
      >
        {checked && <Text style={[styles.checkmark, { color: onTint }]}>✓</Text>}
      </View>
      <View style={styles.checkboxLabelWrap}>
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.checkboxHint, { color: colors.labelText }]}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
