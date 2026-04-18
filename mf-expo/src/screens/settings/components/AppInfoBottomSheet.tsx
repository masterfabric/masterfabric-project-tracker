/**
 * Bottom sheet showing app config, version info, and service details.
 * Opened via long press on the About row in settings.
 * Styled like the home sync card (auth-banner): card layout, tip badge, shadow.
 */

import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MarkdownText } from '@/src/shared/components/MarkdownText';
import { ThemedText } from '@/src/shared/components/ThemedText';
import { APP_CONFIG } from '@/src/shared/constants';
import { t } from '@/src/shared/i18n';
import { mfGoSettings } from '@/src/shared/services';
import type { ProductRelease } from '@/src/shared/services/mf-go-api';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import type { AppConfigParams } from '@/src/shared/services/app-config-service';

interface AppInfoBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  appConfig: AppConfigParams | null;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\s+/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function featureFlagHint(key: string): string {
  const fullKey = `settings.sections.about.featureFlagKeys.${key}`;
  const specific = t(fullKey);
  if (specific !== key) return specific;
  return t('settings.sections.about.featureFlagDefaultExplain');
}

function InfoRow({
  label,
  value,
  hint,
  isLast,
}: {
  label: string;
  value: string;
  hint?: string;
  isLast?: boolean;
}) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  return (
    <View style={[styles.infoRowBlock, isLast && styles.infoRowLast]}>
      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: colors.labelText }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.bodyText }]} numberOfLines={3}>
          {value || '—'}
        </Text>
      </View>
      {hint ? (
        <Text style={[styles.infoHint, { color: colors.labelText }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

function InfoCard({
  badge,
  badgeColor,
  badgeTextColor = '#FFFFFF',
  icon,
  iconColor,
  title,
  subtitle,
  children,
  isDark,
  colors,
}: {
  badge: string;
  badgeColor: string;
  /** Use `foregroundOnTint(isDark)` when badge uses `colors.tint` (light in dark mode). */
  badgeTextColor?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isDark: boolean;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const cardStyle = {
    backgroundColor: colors.surfaceBackground,
    borderColor: colors.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.06,
    shadowRadius: 8,
    elevation: 3,
  };

  return (
    <View style={[styles.infoCard, cardStyle]}>
      <View
        style={[
          styles.infoCardBadge,
          { backgroundColor: badgeColor },
        ]}
      >
        <Text style={[styles.infoCardBadgeText, { color: badgeTextColor }]}>{badge}</Text>
      </View>
      <View style={styles.infoCardHeader}>
        <View style={[styles.infoCardIcon, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        <View style={styles.infoCardHeaderText}>
          <Text style={[styles.infoCardTitle, { color: colors.bodyText }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.infoCardSubtitle, { color: colors.labelText }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.infoCardContent}>{children}</View>
    </View>
  );
}

export function AppInfoBottomSheet({
  visible,
  onClose,
  appConfig,
}: AppInfoBottomSheetProps) {
  const [remoteRelease, setRemoteRelease] = React.useState<ProductRelease | null>(null);
  const [releaseLoading, setReleaseLoading] = React.useState(false);
  const [releaseLoadFailed, setReleaseLoadFailed] = React.useState(false);

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setReleaseLoading(true);
    setReleaseLoadFailed(false);
    setRemoteRelease(null);
    mfGoSettings
      .productRelease()
      .then((pr) => {
        if (!cancelled) {
          setRemoteRelease(pr);
          setReleaseLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteRelease(null);
          setReleaseLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setReleaseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  /** Bottom sheet height — updates on rotation */
  const sheetMaxH = Math.round(
    Math.min(winH * Sizing.modal.sheetMaxHeightFraction, winH - Math.max(insets.top, 8))
  );

  const appName = Constants.expoConfig?.name ?? appConfig?.appName ?? 'MF Project Tracker';
  const appVersion = Constants.expoConfig?.version ?? appConfig?.appVersion ?? '1.2.0';
  const appBuild =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber ?? '—'
      : Constants.expoConfig?.android?.versionCode?.toString() ?? '—';
  const expoVersion = Constants.expoVersion ?? '—';

  const featureFlags = appConfig?.featureFlags ?? {};
  const rawSettings = appConfig?.raw ?? [];
  const graphqlUrl = APP_CONFIG.GRAPHQL_URL;
  const platformLabel = `${Platform.OS} (${Platform.Version ?? '—'})`;
  const envLabel = __DEV__
    ? t('settings.sections.about.envDevelopment')
    : t('settings.sections.about.envProduction');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.sheetShell,
            {
              maxHeight: sheetMaxH,
              backgroundColor: colors.background,
              borderColor: colors.surfaceBorder,
              paddingBottom: Math.max(insets.bottom, Sizing.padding.m),
            },
          ]}
        >
          <View style={styles.handle} />
          <ThemedText
            type="title"
            style={[styles.title, { color: colors.bodyText }]}
          >
            {t('settings.sections.about.sheetTitle')}
          </ThemedText>
          <Text style={[styles.subtitle, { color: colors.labelText }]}>
            {t('settings.sections.about.sheetSubtitleExtended')}
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            bounces
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {/** Version info card */}
            <InfoCard
              badge={t('settings.sections.about.version')}
              badgeColor={colors.tint}
              badgeTextColor={onTint}
              icon="layers"
              iconColor={colors.tint}
              title={t('settings.sections.about.version')}
              subtitle={t('settings.sections.about.versionDesc')}
              isDark={isDark}
              colors={colors}
            >
              <InfoRow label={t('settings.sections.about.appName')} value={appName} />
              <InfoRow label={t('settings.sections.about.appVersion')} value={appVersion} />
              <InfoRow label={t('settings.sections.about.appBuild')} value={appBuild} />
              <InfoRow label={t('settings.sections.about.expoVersion')} value={expoVersion} isLast />
            </InfoCard>

            {/** Second section: current published release from mf-go (always visible while sheet is open) */}
            <InfoCard
              badge={t('settings.sections.about.productReleaseBadge')}
              badgeColor="#AF52DE"
              icon="ribbon"
              iconColor="#AF52DE"
              title={t('settings.sections.about.productReleaseTitle')}
              subtitle={t('settings.sections.about.productReleaseSubtitle')}
              isDark={isDark}
              colors={colors}
            >
              {releaseLoading && !remoteRelease ? (
                <View style={styles.releaseLoadingBlock}>
                  <ActivityIndicator size="small" color={colors.tint} />
                  <Text style={[styles.releaseLoadingText, { color: colors.labelText }]}>
                    {t('settings.sections.about.productReleaseLoading')}
                  </Text>
                </View>
              ) : releaseLoadFailed && !remoteRelease ? (
                <Text style={[styles.releaseError, { color: '#FF3B30' }]}>
                  {t('settings.sections.about.productReleaseLoadError')}
                </Text>
              ) : remoteRelease ? (
                <>
                  <InfoRow
                    label={t('settings.sections.about.publishedVersionLabel')}
                    value={remoteRelease.version}
                  />
                  {remoteRelease.updatedAt ? (
                    <InfoRow
                      label={t('settings.sections.about.productReleaseLastPublished')}
                      value={
                        remoteRelease.updatedByDisplayName
                          ? `${new Date(remoteRelease.updatedAt).toLocaleString()} · ${remoteRelease.updatedByDisplayName}`
                          : new Date(remoteRelease.updatedAt).toLocaleString()
                      }
                    />
                  ) : null}
                  <View style={styles.changelogBlock}>
                    <Text style={[styles.changelogLabel, { color: colors.labelText }]}>
                      {t('settings.sections.about.publishedChangelogLabel')}
                    </Text>
                    {remoteRelease.changelogMarkdown?.trim() ? (
                      <MarkdownText
                        markdown={remoteRelease.changelogMarkdown}
                        baseStyle={[styles.changelogBody, { color: colors.bodyText }]}
                        selectable
                      />
                    ) : (
                      <Text
                        style={[styles.changelogBody, { color: colors.bodyText }]}
                        selectable
                      >
                        {t('settings.sections.about.productReleaseEmptyChangelog')}
                      </Text>
                    )}
                  </View>
                </>
              ) : (
                <Text style={[styles.releaseError, { color: colors.labelText }]}>
                  {t('settings.sections.about.productReleaseLoadError')}
                </Text>
              )}
            </InfoCard>

            {/** Backend & device — how this app talks to services */}
            <InfoCard
              badge={t('settings.sections.about.servicesBadge')}
              badgeColor="#5856D6"
              icon="cloud-done"
              iconColor="#5856D6"
              title={t('settings.sections.about.servicesTitle')}
              subtitle={t('settings.sections.about.servicesSubtitle')}
              isDark={isDark}
              colors={colors}
            >
              <InfoRow
                label={t('settings.sections.about.graphqlEndpoint')}
                value={graphqlUrl}
                hint={t('settings.sections.about.graphqlEndpointHint')}
              />
              <InfoRow
                label={t('settings.sections.about.platform')}
                value={platformLabel}
                hint={t('settings.sections.about.platformHint')}
              />
              <InfoRow
                label={t('settings.sections.about.environment')}
                value={envLabel}
                hint={t('settings.sections.about.environmentHint')}
                isLast
              />
            </InfoCard>

            {/** Feature flags card */}
            {Object.keys(featureFlags).length > 0 && (
              <InfoCard
                badge={t('settings.sections.about.featureFlags')}
                badgeColor="#34C759"
                icon="flag"
                iconColor="#34C759"
                title={t('settings.sections.about.featureFlags')}
                subtitle={t('settings.sections.about.featureFlagsDesc')}
                isDark={isDark}
                colors={colors}
              >
                {Object.entries(featureFlags).map(([key, value], i, arr) => (
                  <InfoRow
                    key={key}
                    label={humanizeKey(key)}
                    value={value ? t('settings.sections.about.flagOn') : t('settings.sections.about.flagOff')}
                    hint={featureFlagHint(key)}
                    isLast={i === arr.length - 1}
                  />
                ))}
              </InfoCard>
            )}

            {/** Raw app settings card */}
            {rawSettings.length > 0 && (
              <InfoCard
                badge={t('settings.sections.about.appSettings')}
                badgeColor="#FF9500"
                icon="server"
                iconColor="#FF9500"
                title={t('settings.sections.about.appSettings')}
                subtitle={t('settings.sections.about.appSettingsDesc')}
                isDark={isDark}
                colors={colors}
              >
                {rawSettings.map((s, i, arr) => (
                  <InfoRow
                    key={s.key}
                    label={humanizeKey(s.key)}
                    value={s.value ?? ''}
                    hint={
                      s.description?.trim()
                        ? s.description
                        : t('settings.sections.about.appSettingKeyHint', { key: s.key })
                    }
                    isLast={i === arr.length - 1}
                  />
                ))}
              </InfoCard>
            )}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: colors.tint,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={[styles.closeButtonText, { color: onTint }]}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    ...(Platform.OS === 'android' && { elevation: 999 }),
  },
  /** Card rising from bottom — turns correctly in landscape (useWindowDimensions) */
  sheetShell: {
    width: '100%',
    paddingHorizontal: Sizing.padding.xl,
    paddingTop: Sizing.padding.s,
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'android' && { elevation: 1000 }),
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)',
    alignSelf: 'center',
    marginBottom: Sizing.padding.m,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Sizing.padding.m,
    opacity: 0.9,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    paddingTop: Sizing.padding.s,
    paddingBottom: Sizing.padding.xl,
  },
  infoCard: {
    marginTop: 12,
    marginBottom: Sizing.padding.l,
    padding: Sizing.padding.l,
    paddingTop: Sizing.padding.l + 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'visible',
  },
  infoCardBadge: {
    position: 'absolute',
    top: -8,
    left: 12,
    zIndex: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  infoCardBadgeText: {
    fontWeight: '600',
    fontSize: 11,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
    marginBottom: Sizing.padding.l,
  },
  infoCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardHeaderText: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoCardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoCardContent: {
    marginTop: 0,
    paddingTop: Sizing.padding.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  infoRowBlock: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    opacity: 0.88,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  closeButton: {
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Sizing.padding.m,
  },
  closeButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  releaseError: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 4,
  },
  releaseLoadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  releaseLoadingText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  changelogBlock: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  changelogLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  changelogBody: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
