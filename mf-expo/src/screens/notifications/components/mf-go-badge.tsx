import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/src/shared/components/ThemedText';
import { useTheme } from 'masterfabric-expo-core';
import { notificationScreenStyles } from '../styles/notification-screen.styles';

interface MfGoBadgeProps {
  additionalText?: string;
}

export function MfGoBadge({ additionalText }: MfGoBadgeProps) {
  const { colors } = useTheme();

  return (
    <View style={[notificationScreenStyles.supabaseBadge, { borderColor: '#2563eb30' }]}>
      <Ionicons name="server" size={20} color="#2563eb" />
      <ThemedText
        style={[notificationScreenStyles.supabaseBadgeText, { color: colors.icon }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        mf-go{additionalText ? ` • ${additionalText}` : ''}
      </ThemedText>
    </View>
  );
}
