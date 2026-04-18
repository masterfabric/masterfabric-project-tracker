import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import { t } from '@/src/shared/i18n';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/src/shared/components/ThemedText';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import { logoSectionStyles } from '../../styles/logo-section.styles';

export function LogoSection() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const appName = t('splash.appName');
  const tagline = t('splash.tagline');

  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  React.useEffect(() => {
    logoScale.value = withSpring(1, { damping: 15, stiffness: 100 });
    logoOpacity.value = withSpring(1, { damping: 15, stiffness: 100 });
    textOpacity.value = withDelay(
      500,
      withSpring(1, { damping: 15, stiffness: 100 })
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <View style={logoSectionStyles.logoContainer}>
      <Animated.View style={logoAnimatedStyle}>
        <Image
          source={require('@/src/assets/images/splash-icon.svg')}
          style={logoSectionStyles.logo}
          contentFit="contain"
        />
      </Animated.View>

      <Animated.View style={[logoSectionStyles.textContainer, textAnimatedStyle]}>
        <ThemedText
          type="title"
          style={[logoSectionStyles.appName, { color: colors.splashText }]}
        >
          {appName}
        </ThemedText>
        <ThemedText
          type="subtitle"
          style={[logoSectionStyles.tagline, { color: colors.splashSubtext }]}
        >
          {tagline}
        </ThemedText>
      </Animated.View>
    </View>
  );
}
