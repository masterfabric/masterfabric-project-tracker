/**
 * Reusable settings row with icon, title, subtitle, and optional chevron.
 * Used across settings sections for consistent navigation rows.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/src/shared/components/ThemedText';
import { settingsStyles } from '../styles/settings-styles';

export interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  rowBg: string;
  titleColor: string;
  subtitleColor: string;
  showChevron?: boolean;
  externalLink?: boolean;
  accessibilityLabel?: string;
}

export const SettingsRow = React.memo(function SettingsRow({
  icon,
  iconBgColor,
  iconColor,
  title,
  subtitle,
  onPress,
  rowBg,
  titleColor,
  subtitleColor,
  showChevron = true,
  externalLink = false,
  accessibilityLabel,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        settingsStyles.row,
        { backgroundColor: rowBg, opacity: pressed ? 0.6 : 1 },
      ]}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <ThemedText type="body" style={[settingsStyles.rowTitle, { color: titleColor }]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="caption" style={[styles.subtitle, { color: subtitleColor }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {showChevron && (
        <Ionicons
          name={externalLink ? 'open-outline' : 'chevron-forward'}
          size={20}
          color={subtitleColor}
        />
      )}
    </Pressable>
  );
});

const styles = {
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
};
