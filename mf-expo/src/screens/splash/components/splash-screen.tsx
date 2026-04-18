import Constants from 'expo-constants';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/src/shared/i18n';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import { useSplashStore } from '../store/splash-store';
import { useSplashViewModel } from '../hooks/use-splash-view-model';
import { splashScreenStyles } from '../styles/splash-screen.styles';

function SplashContent() {
  useSplashViewModel();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const loadingMessage = useSplashStore((s) => s.loadingMessage);

  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 380 });
  }, [opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const appName = Constants.expoConfig?.name ?? t('splash.appName');
  const tagline = Constants.expoConfig?.description ?? t('splash.tagline');
  const version = Constants.expoConfig?.version ?? '1.2.0';
  const build =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode?.toString();
  const versionLine =
    build != null && build !== ''
      ? t('splash.versionWithBuild', { version, build })
      : t('splash.versionOnly', { version });

  const bg = colors.splashBackground ?? colors.background;

  return (
    <View style={[splashScreenStyles.root, { backgroundColor: bg }]}>
      <SafeAreaView style={splashScreenStyles.safe}>
        <Animated.View style={[splashScreenStyles.center, fadeStyle]}>
          <Image
            source={require('@/src/assets/images/app_icon.png')}
            style={splashScreenStyles.logo}
            contentFit="contain"
          />
          <Text
            style={[splashScreenStyles.appName, { color: colors.splashText ?? colors.bodyText }]}
            numberOfLines={2}
          >
            {appName}
          </Text>
          <Text
            style={[splashScreenStyles.versionRow, { color: colors.tint }]}
            selectable={false}
          >
            {versionLine}
          </Text>
          {__DEV__ ? (
            <Text style={[splashScreenStyles.envBadge, { color: colors.labelText }]}>
              {t('splash.devMode')}
            </Text>
          ) : null}
          <Text
            style={[splashScreenStyles.tagline, { color: colors.splashSubtext ?? colors.labelText }]}
            numberOfLines={2}
          >
            {tagline}
          </Text>
        </Animated.View>

        <View style={splashScreenStyles.footer}>
          <ActivityIndicator size="small" color={colors.tint} />
          <Text
            style={[splashScreenStyles.status, { color: colors.labelText }]}
            numberOfLines={2}
          >
            {loadingMessage}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

export function SplashScreen() {
  return <SplashContent />;
}
