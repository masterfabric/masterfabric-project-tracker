import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useMasterView } from 'masterfabric-expo-core';
import { ThemedSurface } from './ThemedSurface';

/** Solid tab bar fill with optional top hairline on iOS. */
export default function TabBarBackground() {
  const { isDark } = useMasterView();
  const hairline = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={StyleSheet.absoluteFill}>
      <ThemedSurface variant="tabBar" style={StyleSheet.absoluteFill} />
      {Platform.OS === 'ios' ? (
        <View
          style={[StyleSheet.absoluteFill, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hairline }]}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}
