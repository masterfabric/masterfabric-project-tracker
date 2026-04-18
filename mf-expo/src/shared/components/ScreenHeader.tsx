import { StageBadge } from '@/src/shared/components/StageBadge';
import { ThemedText } from '@/src/shared/components/ThemedText';
import {
  appBarAmbientShadow,
  appBarBottomHairline,
  appBarHairlineOverlayStyle,
} from '@/src/shared/components/ui/app-bar-metrics';
import { t } from '@/src/shared/i18n';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getThemeColors, Sizing, useMasterView } from 'masterfabric-expo-core';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const packageInfo = require('@/package.json');

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  showBackButton?: boolean;
  /** `text` — localized label (e.g. Back); `icon` — chevron */
  backButtonVariant?: 'icon' | 'text';
  showStageBadge?: boolean;
  variant?: 'default' | 'minimal' | 'centered';
  rightAction?: React.ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  onBackPress,
  showBackButton = true,
  backButtonVariant = 'icon',
  showStageBadge = false,
  variant = 'default',
  rightAction,
}: ScreenHeaderProps) {
  const { isDark } = useMasterView();
  const colors = getThemeColors(isDark);
  const hairline = appBarBottomHairline(isDark);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const stage = packageInfo.stage || 'development';
  const shouldShowBadge = showStageBadge && (stage === 'development' || stage === 'debug' || stage === 'dev');

  const rowPadding =
    variant === 'minimal' ? styles.rowMinimal : variant === 'centered' ? styles.rowCentered : styles.rowDefault;

  return (
    <View style={[styles.shell, { backgroundColor: colors.headerBackground }, appBarAmbientShadow(isDark)]}>
      <View pointerEvents="none" style={appBarHairlineOverlayStyle(hairline)} />

      <View style={[styles.row, rowPadding]}>
        {showBackButton ? (
          <TouchableOpacity
            onPress={handleBackPress}
            style={
              backButtonVariant === 'text' ? styles.backButtonText : styles.backButton
            }
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {backButtonVariant === 'text' ? (
              <ThemedText
                style={[styles.backButtonTextLabel, { color: colors.text }]}
                numberOfLines={1}
              >
                {t('common.back')}
              </ThemedText>
            ) : (
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            )}
          </TouchableOpacity>
        ) : null}

        <View
          style={[
            styles.headerContent,
            { marginLeft: showBackButton ? 4 : 0 },
            variant === 'centered' && styles.headerContentCentered,
          ]}
        >
          <View style={[styles.titleContainer, variant === 'centered' && styles.titleContainerCentered]}>
            <ThemedText style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </ThemedText>
            {shouldShowBadge ? <StageBadge type="text" /> : null}
          </View>
          {subtitle ? (
            <ThemedText
              style={[styles.headerSubtitle, { color: colors.labelText }]}
              numberOfLines={2}
            >
              {subtitle}
            </ThemedText>
          ) : null}
        </View>

        {rightAction ??
          (showBackButton ? (
            <View
              style={
                backButtonVariant === 'text'
                  ? styles.headerSpacerTextBack
                  : styles.headerSpacer
              }
            />
          ) : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  rowDefault: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowMinimal: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  rowCentered: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -6,
    borderRadius: 10,
  },
  backButtonText: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 7,
    paddingRight: 8,
    marginLeft: -4,
    minHeight: 36,
  },
  backButtonTextLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headerContent: {
    flex: 1,
  },
  headerContentCentered: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Sizing.typography.fontSize.xl,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 2,
    /** Explicit line height: ThemedText default is 22pt — too tight for xl + bold (clips caps on iOS). */
    lineHeight: 26,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.72,
    lineHeight: 18,
  },
  headerSpacer: {
    width: 36,
  },
  headerSpacerTextBack: {
    minWidth: 36,
    width: 44,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  titleContainerCentered: {
    justifyContent: 'center',
  },
});
