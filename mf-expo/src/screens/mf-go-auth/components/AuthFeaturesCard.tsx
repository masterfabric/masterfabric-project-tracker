import { t } from '@/src/shared/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Sizing, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const features = [
  { key: 'sync', icon: 'sync' as const, labelKey: 'auth.mfGo.features.sync' },
  { key: 'teams', icon: 'people' as const, labelKey: 'auth.mfGo.features.teams' },
  { key: 'organizations', icon: 'business' as const, labelKey: 'auth.mfGo.features.organizations' },
];

export function AuthFeaturesCard() {
  const { isDark, colors } = useTheme();

  return (
    <View
      style={[
        localStyles.card,
        {
          backgroundColor: isDark ? colors.inputBackground : colors.surfaceBackground,
          borderColor: colors.surfaceBorder,
        },
      ]}
    >
      {features.map((f) => (
        <View key={f.key} style={localStyles.row}>
          <View style={[localStyles.iconWrap, { backgroundColor: colors.tint + '20' }]}>
            <Ionicons name={f.icon} size={18} color={colors.tint} />
          </View>
          <Text style={[localStyles.label, { color: colors.bodyText }]}>
            {t(f.labelKey)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const localStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Sizing.padding.m,
    marginBottom: Sizing.padding.l,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizing.padding.s,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Sizing.padding.m,
  },
  label: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
