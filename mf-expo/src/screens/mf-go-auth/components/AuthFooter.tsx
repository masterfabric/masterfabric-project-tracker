import { t } from '@/src/shared/i18n';
import { Sizing, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Tab = 'login' | 'register';

interface AuthFooterProps {
  tab: Tab;
  onSwitchTab: () => void;
}

export function AuthFooter({ tab, onSwitchTab }: AuthFooterProps) {
  const { colors } = useTheme();

  const prompt = tab === 'login'
    ? t('auth.dontHaveAccount')
    : t('auth.alreadyHaveAccount');
  const action = tab === 'login'
    ? t('auth.signUp')
    : t('auth.signIn');

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: Sizing.padding.l,
        marginBottom: Sizing.padding.xxl,
        paddingBottom: Sizing.padding.m,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 15, color: colors.labelText }}>{prompt}</Text>
      <Pressable onPress={onSwitchTab} hitSlop={8}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.tint }}>{action}</Text>
      </Pressable>
    </View>
  );
}
