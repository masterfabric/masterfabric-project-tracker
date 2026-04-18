import { router } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import {
  appBarAmbientShadow,
  appBarBottomHairline,
  appBarHairlineOverlayStyle,
} from '@/src/shared/components/ui/app-bar-metrics';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { homeHeaderStyles } from '../styles/home-header.styles';
import { HeaderActions } from './header-actions';
import { HeaderLogo } from './header-logo';

interface HomeHeaderProps {
  onNotificationPress?: () => void;
  onTitleTripleTap?: () => void;
}

export const HomeHeader = React.memo(function HomeHeader({
  onNotificationPress,
  onTitleTripleTap,
}: HomeHeaderProps) {
  // Subscribe to locale so header title / a11y labels update (memo would otherwise block re-renders)
  useLocale();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const handleNotificationPress = useCallback(() => {
    router.push('/notifications');
    onNotificationPress?.();
  }, [onNotificationPress]);

  const handleProfilePress = useCallback(() => {
    router.push('/profile');
  }, []);

  const hairline = useMemo(() => appBarBottomHairline(isDark), [isDark]);

  const shellStyle = useMemo(
    () => [
      homeHeaderStyles.shell,
      { backgroundColor: colors.headerBackground },
      appBarAmbientShadow(isDark),
    ],
    [colors.headerBackground, isDark]
  );

  return (
    <View style={shellStyle}>
      <View pointerEvents="none" style={appBarHairlineOverlayStyle(hairline)} />
      <View style={homeHeaderStyles.row}>
        <View style={homeHeaderStyles.logoSection}>
          <HeaderLogo onTripleTap={onTitleTripleTap} />
        </View>
        <HeaderActions
          onNotificationPress={handleNotificationPress}
          onProfilePress={handleProfilePress}
        />
      </View>
    </View>
  );
});
