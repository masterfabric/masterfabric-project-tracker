import { Image } from 'expo-image';
import React, { useCallback, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import { SOFT_CARD_RADIUS, cardShadowStyle } from '@/src/shared/ui/screen-card-styles';

/** Matches settings store badge proportions (see `SettingsStoreBanner`, Figma Banner Store Button frame). */
const CURSOR_SITE_URL = 'https://cursor.com';
const BADGE_MIN_HEIGHT = 72;
const LOGO_SIZE = 40;

/**
 * Bottom settings “Made with Cursor” row: themed card (matches settings grouped rows), mark + two-line copy; opens cursor.com.
 * Logo: bundled `cursor-settings-badge-logo.png` (raster from Cursor’s public **https://cursor.com** `logo.svg`).
 */
export const SettingsCursorBanner = React.memo(function SettingsCursorBanner() {
  const { isDark } = useTheme();
  const { locale } = useLocale();
  const colors = getThemeColors(isDark);

  const badgeLines = useMemo(
    () => ({
      line1: t('settings.cursorBadge.line1'),
      line2: t('settings.cursorBadge.line2'),
    }),
    [locale]
  );

  const a11yLabel = useMemo(() => t('settings.cursorBadge.accessibilityLabel'), [locale]);

  const handlePress = useCallback(() => {
    void Linking.openURL(CURSOR_SITE_URL);
  }, []);

  return (
    <View style={[{ borderRadius: SOFT_CARD_RADIUS, marginTop: 12 }, cardShadowStyle(isDark)]}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="link"
        accessibilityLabel={a11yLabel}
        style={({ pressed }) => [
          styles.badge,
          {
            backgroundColor: colors.settingsCardBackground,
            borderColor: colors.settingsCardBorder,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={styles.innerRow}>
          <View style={styles.logoWrap}>
            <Image
              source={require('@/src/assets/images/cursor-settings-badge-logo.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
          <View style={styles.copyCol}>
            <Text style={[styles.line1, { color: colors.labelText }]} numberOfLines={1}>
              {badgeLines.line1}
            </Text>
            <Text style={[styles.line2, { color: colors.bodyText }]} numberOfLines={1}>
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
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  copyCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  line1: {
    opacity: 0.92,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
    letterSpacing: 0.15,
  },
  line2: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 24,
  },
});
