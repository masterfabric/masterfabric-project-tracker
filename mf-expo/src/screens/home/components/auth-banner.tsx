import { ThemedText } from '@/src/shared/components/ThemedText';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SOFT_CARD_RADIUS, cardShadowStyle } from '@/src/shared/ui/screen-card-styles';
import { Ionicons } from '@expo/vector-icons';

export const AuthBanner = React.memo(function AuthBanner() {
  useLocale();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);

  return (
    <View
      style={[
        { marginTop: 8, marginBottom: Sizing.padding.m, borderRadius: SOFT_CARD_RADIUS },
        cardShadowStyle(isDark),
      ]}
    >
      <Pressable
        onPress={() => router.push('/mf-go-auth')}
        style={({ pressed }) => [
          {
            padding: Sizing.padding.m + 2,
            paddingTop: Sizing.padding.m + 8,
            backgroundColor: colors.surfaceBackground,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? colors.surfaceBorder + 'AA' : colors.tint + '14',
            borderRadius: SOFT_CARD_RADIUS,
            opacity: pressed ? 0.97 : 1,
          },
        ]}
      >
      <View
        style={{
          position: 'absolute',
          top: -6,
          left: 14,
          paddingHorizontal: 10,
          paddingVertical: 4,
          backgroundColor: colors.tint,
          borderRadius: 20,
        }}
      >
        <ThemedText
          type="caption"
          style={{ fontWeight: '600', color: onTint, fontSize: 11 }}
        >
          {t('home.authBanner.tip')}
        </ThemedText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: isDark ? colors.tint + '18' : colors.tint + '10',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="key-outline" size={24} color={colors.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText
            type="subtitle"
            style={{
              fontWeight: '600',
              color: colors.bodyText,
              marginBottom: 2,
            }}
          >
            {t('home.authBanner.title')}
          </ThemedText>
          <ThemedText
            type="body"
            style={{
              fontSize: 13,
              color: colors.labelText,
              lineHeight: 18,
            }}
          >
            {t('home.authBanner.message')}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.labelText} />
      </View>
      </Pressable>
    </View>
  );
});
