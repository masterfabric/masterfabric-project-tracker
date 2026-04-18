import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface AppBarScaffoldProps {
  style?: ViewStyle;
  /** Screen background (SafeAreaView). */
  backgroundColor: string;
  safeAreaEdges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Renders behind app bar + body (optional decorative layer). */
  backdrop?: React.ReactNode;
  /** Top bar: ScreenHeader, HomeHeader, or custom stack. */
  appBar: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Standard column layout: safe area → app bar (intrinsic height) → flex body.
 * Content is not drawn under the app bar.
 */
export function AppBarScaffold({
  style,
  backgroundColor,
  safeAreaEdges = ['top', 'bottom'],
  backdrop,
  appBar,
  children,
}: AppBarScaffoldProps) {
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor }, style]} edges={safeAreaEdges}>
      <View style={styles.fill}>
        {backdrop ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {backdrop}
          </View>
        ) : null}
        <View style={styles.column}>
          {appBar}
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  column: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});
