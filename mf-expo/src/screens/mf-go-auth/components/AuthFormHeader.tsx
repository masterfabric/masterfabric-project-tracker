import { t } from '@/src/shared/i18n';
import { useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { Text, View } from 'react-native';
import { mfGoAuthStyles as styles } from '../styles/mf-go-auth.styles';

type Tab = 'login' | 'register';

interface AuthFormHeaderProps {
  tab: Tab;
}

export function AuthFormHeader({ tab }: AuthFormHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>
        {tab === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.labelText }]}>
        {t('auth.mfGo.subtitle')}
      </Text>
      <Text style={[styles.infoText, { color: colors.labelText }]}>
        {tab === 'login'
          ? t('auth.mfGo.signInInfo')
          : t('auth.mfGo.signUpInfo')}
      </Text>
    </View>
  );
}
