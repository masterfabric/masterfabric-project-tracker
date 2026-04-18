import React from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/src/shared/components/ThemedText';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import { useSplashStore } from '../../store/splash-store';
import { infoSectionStyles } from '../../styles/info-section.styles';
import { VersionInfo } from '../version-info';

export function InfoSection() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const loadingMessage = useSplashStore((s) => s.loadingMessage);

  return (
    <View style={infoSectionStyles.container}>
      <ThemedText
        style={[infoSectionStyles.loadingText, { color: colors.splashSubtext }]}
        numberOfLines={1}
      >
        {loadingMessage}
      </ThemedText>
      <VersionInfo />
    </View>
  );
}
