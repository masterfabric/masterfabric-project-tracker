import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import { progressSectionStyles } from '../../styles/progress-section.styles';

function PulsingDot({ delay, color }: { delay: number; color: string }) {
  const scale = useSharedValue(0.8);
  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(withTiming(1.2, { duration: 500 }), -1, true)
    );
  }, [delay, scale]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      style={[
        progressSectionStyles.dot,
        { backgroundColor: color },
        style,
      ]}
    />
  );
}

export function ProgressSection() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  return (
    <View style={progressSectionStyles.loadingContainer}>
      <PulsingDot delay={0} color={colors.splashProgress} />
      <PulsingDot delay={100} color={colors.splashProgress} />
      <PulsingDot delay={200} color={colors.splashProgress} />
    </View>
  );
}
