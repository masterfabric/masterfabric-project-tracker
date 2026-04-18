import Constants from 'expo-constants';
import React from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/src/shared/components/ThemedText';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import { versionInfoStyles } from '../styles/version-info.styles';

export function VersionInfo() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const version = Constants.expoConfig?.version ?? '1.2.0';

  return (
    <View style={versionInfoStyles.container}>
      <ThemedText
        type="default"
        style={[versionInfoStyles.versionText, { color: colors.splashText }]}
      >
        v{version}
      </ThemedText>
    </View>
  );
}
