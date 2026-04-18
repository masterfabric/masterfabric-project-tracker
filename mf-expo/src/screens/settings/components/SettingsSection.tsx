/**
 * Reusable settings section with header, description, and elevated card container.
 */

import React from 'react';
import { Text, View } from 'react-native';
import { settingsStyles } from '../styles/settings-styles';
import { SOFT_CARD_RADIUS, cardShadowStyle } from '@/src/shared/ui/screen-card-styles';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  isFirst?: boolean;
  sectionHeaderColor: string;
  isDark: boolean;
  rowBg: string;
  children: React.ReactNode;
}

export const SettingsSection = React.memo(function SettingsSection({
  title,
  description,
  isFirst = false,
  sectionHeaderColor,
  isDark,
  rowBg,
  children,
}: SettingsSectionProps) {
  return (
    <>
      <Text
        style={[
          settingsStyles.sectionHeader,
          isFirst && settingsStyles.sectionHeaderFirst,
          { color: sectionHeaderColor },
        ]}
      >
        {title.toUpperCase()}
      </Text>
      {description ? (
        <Text style={[styles.sectionDescription, { color: sectionHeaderColor }]}>
          {description}
        </Text>
      ) : null}
      <View
        style={[
          { borderRadius: SOFT_CARD_RADIUS, marginBottom: 10 },
          cardShadowStyle(isDark),
        ]}
      >
        <View
          style={{
            borderRadius: SOFT_CARD_RADIUS,
            overflow: 'hidden' as const,
            backgroundColor: rowBg,
          }}
        >
          {children}
        </View>
      </View>
    </>
  );
});

const styles = {
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
    opacity: 0.9,
  },
};
