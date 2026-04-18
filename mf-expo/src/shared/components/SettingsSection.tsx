import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Sizing } from 'masterfabric-expo-core';
import { ThemedText } from './ThemedText';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  style?: any;
}

export function SettingsSection({ title, description, children, style }: SettingsSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {description && (
          <ThemedText style={[styles.description, { opacity: 0.7 }]}>
            {description}
          </ThemedText>
        )}
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Sizing.padding.xxl,
    paddingHorizontal: Sizing.padding.l,
  },
  header: {
    marginBottom: Sizing.padding.m,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: Sizing.padding.xs,
  },
  description: {
    fontSize: Sizing.typography.fontSize.m,
    lineHeight: 20,
  },
  content: {
    gap: Sizing.padding.m,
  },
});
