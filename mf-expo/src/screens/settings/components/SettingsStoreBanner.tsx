import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { urlLauncherHelper, useTheme } from 'masterfabric-expo-core';
import type { AppConfigParams } from '@/src/shared/services/app-config-service';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import { SOFT_CARD_RADIUS, cardShadowStyle } from '@/src/shared/ui/screen-card-styles';

/**
 * Settings bottom App Store CTA (iOS only). Android / web do not render this banner.
 */

export interface SettingsStoreBannerProps {
  appConfig: AppConfigParams | null;
}

function readIosAppStoreId(): string {
  const extra = Constants.expoConfig?.extra as { iosAppStoreId?: string } | undefined;
  return (extra?.iosAppStoreId ?? '').trim();
}

/** Figma reference frame ~634×206 — used for minimum tap target / proportion only */
const BADGE_MIN_HEIGHT = 72;

export const SettingsStoreBanner = React.memo(function SettingsStoreBanner({
  appConfig,
}: SettingsStoreBannerProps) {
  const { isDark } = useTheme();
  const { locale } = useLocale();
  const displayName =
    Constants.expoConfig?.name ?? appConfig?.appName ?? 'MF Project Tracker';

  const badgeLines = useMemo(
    () => ({
      line1: t('settings.storeBadge.apple.line1'),
      line2: t('settings.storeBadge.apple.line2'),
    }),
    [locale]
  );

  const a11yLabel = useMemo(
    () =>
      t('settings.storeBadge.accessibilityLabel', {
        store: t('settings.storeBadge.accessibilityStoreApple'),
      }),
    [locale]
  );

  const handlePress = useCallback(async () => {
    const numericId = readIosAppStoreId();
    if (numericId && /^\d+$/.test(numericId)) {
      await urlLauncherHelper.openAppStore(numericId);
      return;
    }
    await Linking.openURL(
      `https://apps.apple.com/search?term=${encodeURIComponent(displayName)}`
    );
  }, [displayName]);

  if (Platform.OS !== 'ios') {
    return null;
  }

  /* Light-theme settings surface is already light; badge stays white-on-black text per Figma */
  const badgeBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <View style={[{ borderRadius: SOFT_CARD_RADIUS, marginTop: 20 }, cardShadowStyle(isDark)]}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={({ pressed }) => [
          styles.badge,
          {
            backgroundColor: '#FFFFFF',
            borderColor: badgeBorder,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={styles.innerRow}>
          <View style={styles.logoWrap}>
            <Ionicons name="logo-apple" size={40} color="#000000" />
          </View>
          <View style={styles.copyCol}>
            <Text style={[styles.line1, styles.line1Apple]} numberOfLines={1}>
              {badgeLines.line1}
            </Text>
            <Text style={styles.line2} numberOfLines={1}>
              {badgeLines.line2}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: BADGE_MIN_HEIGHT,
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrap: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  copyCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  line1: {
    color: '#000000',
    opacity: 0.85,
  },
  line1Apple: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
    letterSpacing: 0.15,
  },
  line2: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: 0.2,
    lineHeight: 24,
  },
});
