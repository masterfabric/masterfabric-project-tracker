import React, { useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { t } from '@/src/shared/i18n';
import { ThemedText } from '@/src/shared/components/ThemedText';
import { useTheme } from 'masterfabric-expo-core';
import { headerLogoSectionStyles } from '../styles/header-logo-section.styles';

const TRIPLE_TAP_WINDOW_MS = 500;

interface HeaderLogoProps {
  onTripleTap?: () => void;
}

export function HeaderLogo({ onTripleTap }: HeaderLogoProps) {
  /** Must use resolved `isDark` (includes theme "system" + OS appearance). */
  const { isDark, colors } = useTheme();
  const headerTitle = t('home.headerTitle');
  const headerSubtitle = t('home.headerSubtitle');

  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const handlePress = useCallback(() => {
    if (!onTripleTap) return;
    const now = Date.now();
    if (now - lastTapRef.current > TRIPLE_TAP_WINDOW_MS) {
      tapCountRef.current = 0;
    }
    lastTapRef.current = now;
    tapCountRef.current += 1;
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      onTripleTap();
    }
  }, [onTripleTap]);

  const titleShadow = isDark
    ? {
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 5,
      }
    : null;

  const a11yHeaderLabel = `${headerTitle}. ${headerSubtitle}`;

  const titleBlock = (
    <View style={headerLogoSectionStyles.titleColumn}>
      <ThemedText
        type="defaultSemiBold"
        accessible={false}
        importantForAccessibility="no"
        style={[
          headerLogoSectionStyles.appName,
          {
            color: colors.headerText,
            fontWeight: '700',
            ...(titleShadow ?? null),
          },
        ]}
      >
        {headerTitle}
      </ThemedText>
      <ThemedText
        type="default"
        accessible={false}
        importantForAccessibility="no"
        numberOfLines={2}
        style={[
          headerLogoSectionStyles.headerSubtitle,
          { color: colors.headerText, opacity: 0.78 },
          titleShadow ?? null,
        ]}
      >
        {headerSubtitle}
      </ThemedText>
    </View>
  );

  return (
    <View style={headerLogoSectionStyles.leftSection}>
      {onTripleTap ? (
        <Pressable onPress={handlePress} hitSlop={12} accessibilityLabel={a11yHeaderLabel}>
          {titleBlock}
        </Pressable>
      ) : (
        <View accessibilityRole="header" accessibilityLabel={a11yHeaderLabel}>
          {titleBlock}
        </View>
      )}
    </View>
  );
}
