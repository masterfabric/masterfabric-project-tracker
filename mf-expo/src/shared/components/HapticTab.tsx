import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

/**
 * Tab bar button with haptics. Intentionally avoids theme hooks so tab count /
 * visibility changes (e.g. expo-router) never trip Rules of Hooks inside tab items.
 */
export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tabButton,
        props.accessibilityState?.selected && styles.selectedTab,
        typeof props.style === 'function' ? props.style({ pressed }) : props.style,
      ]}
      onPressIn={(ev) => {
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 16,
  },
  selectedTab: {
    transform: [{ scale: 1.05 }],
    backgroundColor: 'rgba(128, 128, 128, 0.14)',
  },
});
