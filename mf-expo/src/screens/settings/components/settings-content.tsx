import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useAppStore } from '@/src/shared/store';
import { useAppConfig } from '@/src/shared/hooks/use-app-config';
import { useMfGoAuth } from '@/src/shared/hooks/use-mf-go-auth';
import { mfGoSettings } from '@/src/shared/services';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import { MessageBottomSheet, okSheetAction } from '@/src/shared/components/MessageBottomSheet';
import { OTPBottomSheet } from '@/src/shared/components/OTPBottomSheet';
import { SignOutConfirmSheet } from '@/src/shared/components/SignOutConfirmSheet';
import { getAuthErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { mfGoOTP, type OTPChannel } from '@/src/shared/services/mf-go-api';
import { SettingsContentProps } from '../models/settings-models';
import { settingsStyles } from '../styles/settings-styles';
import { AppearanceCard } from './appearance-card';
import { LanguageCard } from './language-card';
import { AppInfoBottomSheet } from './AppInfoBottomSheet';
import { BroadcastNotificationSheet } from './BroadcastNotificationSheet';
import { SendUserMessageSheet } from './SendUserMessageSheet';
import { SettingsRow } from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { SettingsCursorBanner } from './SettingsCursorBanner';
import { SettingsStoreBanner } from './SettingsStoreBanner';
import { SendFeedbackBottomSheet } from '@/src/screens/support/components/send-feedback-bottom-sheet';
import { t } from '@/src/shared/i18n';

/** Extra space above the absolute tab bar so the last card (e.g. store banner) is not clipped. */
const TAB_BAR_SCROLL_GAP = 16;

export const SettingsContent = React.memo(function SettingsContent({
  currentLanguage,
  onLanguageChange,
  selectedTheme,
  onThemeChange,
}: SettingsContentProps) {
  const tabBarInset = React.useContext(BottomTabBarHeightContext) ?? 0;
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { logout, isLoading } = useMfGoAuth();
  const { config: appConfig } = useAppConfig();
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const [showAppInfoSheet, setShowAppInfoSheet] = useState(false);
  const [showBroadcastSheet, setShowBroadcastSheet] = useState(false);
  const [showSendUserMessageSheet, setShowSendUserMessageSheet] = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  // OTP toggle state
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [showOTPSheet, setShowOTPSheet] = useState(false);
  const [otpDeliveryChannel, setOtpDeliveryChannel] = useState<OTPChannel | null>(null);
  const [pendingOTPValue, setPendingOTPValue] = useState<boolean>(false);
  const [otpRequestError, setOtpRequestError] = useState<string | null>(null);

  // Load OTP when signed in (no "loaded" flag in deps — that caused an extra effect pass / set-state-in-effect lint)
  React.useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    mfGoSettings
      .mySettings()
      .then((s) => {
        if (cancelled) return;
        setOtpEnabled(s.otpEnabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleOTPToggle = useCallback(async (value: boolean) => {
    setPendingOTPValue(value);
    setOtpRequestError(null);
    setOtpLoading(true);
    try {
      const payload = await mfGoOTP.request('VERIFY_IDENTITY');
      setOtpDeliveryChannel(payload.channel);
      setShowOTPSheet(true);
    } catch (e) {
      const uiMessage = getAuthErrorMessage(e);
      setOtpDeliveryChannel(null);
      setShowOTPSheet(false);
      setOtpRequestError(uiMessage);
    } finally {
      setOtpLoading(false);
    }
  }, []);

  const handleOTPVerified = useCallback(async () => {
    setShowOTPSheet(false);
    setOtpDeliveryChannel(null);
    setOtpLoading(true);
    try {
      const result = await mfGoSettings.updateMySettings({ otpEnabled: pendingOTPValue });
      setOtpEnabled(result.otpEnabled);
    } catch {
      // failed to update
    } finally {
      setOtpLoading(false);
    }
  }, [pendingOTPValue]);

  const handleSignOutConfirm = async () => {
    await logout();
    setShowSignOutSheet(false);
  };

  const sectionHeaderColor = colors.settingsDescription;
  const rowBg = colors.settingsCardBackground;
  const separatorColor = colors.divider;
  /** Dark mode `tint` is off-white (#EBEBF5) — same as the iOS thumb, so the ON track disappears. Use success green for ON in dark mode. */
  const otpSwitchTrackOn = isDark ? colors.successColor : colors.tint;

  const handleNotificationsPress = useCallback(() => router.push('/notifications'), []);
  const handlePushSettingsPress = useCallback(() => Linking.openSettings(), []);
  const handlePrivacyPress = useCallback(() => Linking.openSettings(), []);
  const handlePrivacyPolicyPress = useCallback(() => router.push('/privacy-policy'), []);
  const handleHelpPress = useCallback(() => router.push('/help-faq'), []);
  const handleFeedbackPress = useCallback(() => setShowFeedbackSheet(true), []);
  const handleMyFeedbackPress = useCallback(() => router.push('/feedback'), []);

  return (
    <ScrollView
      style={settingsStyles.content}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        settingsStyles.contentContainer,
        { paddingTop: 14 },
        {
          paddingBottom:
            Sizing.padding.xxl +
            tabBarInset +
            (tabBarInset > 0 ? TAB_BAR_SCROLL_GAP : 0),
        },
      ]}
    >
      {/* Language */}
      <SettingsSection
        title={t('settings.sections.language.title')}
        description={t('settings.sections.language.description')}
        isFirst
        sectionHeaderColor={sectionHeaderColor}
        isDark={isDark}
        rowBg={rowBg}
      >
        <LanguageCard
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
          variant="row"
          rowBg={rowBg}
        />
      </SettingsSection>

      {/* Appearance (theme) */}
      <SettingsSection
        title={t('settings.sections.appearance.title')}
        description={t('settings.sections.appearance.description')}
        sectionHeaderColor={sectionHeaderColor}
        isDark={isDark}
        rowBg={rowBg}
      >
        <AppearanceCard
          selectedTheme={selectedTheme}
          onThemeChange={onThemeChange}
          variant="row"
          rowBg={rowBg}
        />
      </SettingsSection>

      {/* NOTIFICATIONS */}
      <SettingsSection
        title={t('settings.sections.notifications.title') || 'Notifications'}
        description={t('settings.sections.notifications.description')}
        sectionHeaderColor={sectionHeaderColor}
        isDark={isDark}
        rowBg={rowBg}
      >
        <SettingsRow
          icon="notifications-outline"
          iconBgColor={colors.tint + '20'}
          iconColor={colors.tint}
          title={t('settings.notifications.title')}
          subtitle={t('settings.notifications.subtitle')}
          onPress={handleNotificationsPress}
          rowBg={rowBg}
          titleColor={colors.bodyText}
          subtitleColor={colors.labelText}
        />
        {Platform.OS !== 'web' ? (
          <>
            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
            <SettingsRow
              icon="phone-portrait-outline"
              iconBgColor={colors.tint + '18'}
              iconColor={colors.tint}
              title={t('settings.pushNotifications.title')}
              subtitle={t('settings.pushNotifications.subtitle')}
              onPress={handlePushSettingsPress}
              rowBg={rowBg}
              titleColor={colors.bodyText}
              subtitleColor={colors.labelText}
              externalLink
            />
          </>
        ) : null}
      </SettingsSection>

      {/* PRIVACY & SECURITY */}
      <SettingsSection
        title={t('settings.sections.privacy.title')}
        description={t('settings.sections.privacy.description')}
        sectionHeaderColor={sectionHeaderColor}
        isDark={isDark}
        rowBg={rowBg}
      >
        <SettingsRow
          icon="shield-checkmark-outline"
          iconBgColor={colors.tint + '20'}
          iconColor={colors.tint}
          title={t('settings.sections.privacy.privacySettings')}
          subtitle={t('settings.sections.privacy.privacySettingsSubtitle')}
          onPress={handlePrivacyPress}
          rowBg={rowBg}
          titleColor={colors.bodyText}
          subtitleColor={colors.labelText}
          externalLink
        />
        <View style={[styles.separator, { backgroundColor: separatorColor }]} />
        <SettingsRow
          icon="document-text-outline"
          iconBgColor={colors.tint + '20'}
          iconColor={colors.tint}
          title={t('settings.sections.privacy.privacyPolicy')}
          subtitle={t('settings.sections.privacy.privacyPolicySubtitle')}
          onPress={handlePrivacyPolicyPress}
          rowBg={rowBg}
          titleColor={colors.bodyText}
          subtitleColor={colors.labelText}
        />
        {isAuthenticated && (
          <>
            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
            <View style={[settingsStyles.row, { backgroundColor: rowBg }]}>
              <View style={[styles.aboutIconContainer, { backgroundColor: '#FF950020' }]}>
                <Ionicons name="key-outline" size={24} color="#FF9500" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[settingsStyles.rowTitle, { color: colors.bodyText }]}>
                  {t('settings.otpRow.title')}
                </Text>
                <Text style={[styles.versionSubtext, { color: colors.labelText }]}>
                  {otpEnabled ? t('settings.otpRow.subtitleOn') : t('settings.otpRow.subtitleOff')}
                </Text>
                <Text style={[styles.otpDeliveryHint, { color: colors.labelText }]}>
                  {t('settings.otpRow.deliveryHint')}
                </Text>
              </View>
              {otpLoading ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : (
                <Switch
                  value={otpEnabled}
                  onValueChange={handleOTPToggle}
                  trackColor={{ false: separatorColor, true: otpSwitchTrackOn }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                  ios_backgroundColor={separatorColor}
                />
              )}
            </View>
          </>
        )}
      </SettingsSection>

      {/* SUPPORT */}
      <SettingsSection
        title={t('settings.sections.support.title')}
        description={t('settings.sections.support.description')}
        sectionHeaderColor={sectionHeaderColor}
        isDark={isDark}
        rowBg={rowBg}
      >
        <SettingsRow
          icon="book-outline"
          iconBgColor={colors.tint + '20'}
          iconColor={colors.tint}
          title={t('settings.sections.support.help')}
          subtitle={t('settings.sections.support.helpSubtitle')}
          onPress={handleHelpPress}
          rowBg={rowBg}
          titleColor={colors.bodyText}
          subtitleColor={colors.labelText}
        />
        <View style={[styles.separator, { backgroundColor: separatorColor }]} />
        <SettingsRow
          icon="chatbubble-ellipses-outline"
          iconBgColor={colors.tint + '20'}
          iconColor={colors.tint}
          title={t('settings.sections.support.feedback')}
          subtitle={t('settings.sections.support.feedbackSubtitle')}
          onPress={handleFeedbackPress}
          rowBg={rowBg}
          titleColor={colors.bodyText}
          subtitleColor={colors.labelText}
        />
        {isAuthenticated ? (
          <>
            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
            <SettingsRow
              icon="mail-unread-outline"
              iconBgColor={colors.tint + '20'}
              iconColor={colors.tint}
              title={t('support.feedback.myFeedbackRow')}
              subtitle={t('support.feedback.myFeedbackSubtitle')}
              onPress={handleMyFeedbackPress}
              rowBg={rowBg}
              titleColor={colors.bodyText}
              subtitleColor={colors.labelText}
            />
          </>
        ) : null}
      </SettingsSection>

      {isAdmin && (
        <SettingsSection
          title={t('settings.sections.admin.title') || 'Admin'}
          description={t('settings.sections.admin.description')}
          sectionHeaderColor={sectionHeaderColor}
          isDark={isDark}
          rowBg={rowBg}
        >
          <SettingsRow
            icon="people-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.adminUserManagement.title')}
            subtitle={t('settings.adminUserManagement.subtitle')}
            onPress={() => router.push('/admin-user-management')}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
          <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          <SettingsRow
            icon="chatbubbles-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.adminFeedback.title')}
            subtitle={t('settings.adminFeedback.subtitle')}
            onPress={() => router.push('/admin-feedback')}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
          <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          <SettingsRow
            icon="document-text-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.adminLegalContent.title')}
            subtitle={t('settings.adminLegalContent.subtitle')}
            onPress={() => router.push('/admin-legal')}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
          <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          <SettingsRow
            icon="phone-portrait-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.adminUserSessions.title')}
            subtitle={t('settings.adminUserSessions.subtitle')}
            onPress={() => router.push('/admin-sessions')}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
          <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          <SettingsRow
            icon="chatbubble-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.sendUserMessage.title')}
            subtitle={t('settings.sendUserMessage.subtitle')}
            onPress={() => setShowSendUserMessageSheet(true)}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
          <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          <SettingsRow
            icon="megaphone-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.broadcast.title')}
            subtitle={t('settings.broadcast.subtitle')}
            onPress={() => setShowBroadcastSheet(true)}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
          <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          <SettingsRow
            icon="git-branch-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.adminProductRelease.title')}
            subtitle={t('settings.adminProductRelease.subtitle')}
            onPress={() => router.push('/admin-version')}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection
          title={t('settings.sections.adminNotifications.title')}
          description={t('settings.sections.adminNotifications.description')}
          sectionHeaderColor={sectionHeaderColor}
          isDark={isDark}
          rowBg={rowBg}
        >
          <SettingsRow
            icon="list-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.adminNotificationHistory.title')}
            subtitle={t('settings.adminNotificationHistory.subtitle')}
            onPress={() => router.push('/admin-notifications')}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
          <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          <SettingsRow
            icon="mail-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.adminMailManagement.navTitle')}
            subtitle={t('settings.adminMailManagement.navSubtitle')}
            onPress={() => router.push('/admin-mail-management')}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
          <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          <SettingsRow
            icon="key-outline"
            iconBgColor={colors.tint + '20'}
            iconColor={colors.tint}
            title={t('settings.adminOtpMail.navTitle')}
            subtitle={t('settings.adminOtpMail.navSubtitle')}
            onPress={() => router.push('/admin-otp-mail')}
            rowBg={rowBg}
            titleColor={colors.bodyText}
            subtitleColor={colors.labelText}
          />
        </SettingsSection>
      )}

      {/* ACCOUNT */}
      <SettingsSection
        title={t('settings.sections.account.title') || 'Account'}
        description={t('settings.sections.account.description')}
        sectionHeaderColor={sectionHeaderColor}
        isDark={isDark}
        rowBg={rowBg}
      >
        {isAuthenticated ? (
          <Pressable
            onPress={() => setShowSignOutSheet(true)}
            style={({ pressed }) => [
              settingsStyles.row,
              { backgroundColor: rowBg, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[settingsStyles.rowTitle, { color: '#FF3B30' }]}>
              {t('settings.logout')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/mf-go-auth')}
            style={({ pressed }) => [
              settingsStyles.row,
              { backgroundColor: rowBg, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[settingsStyles.rowTitle, { color: colors.tint }]}>
              {t('auth.signIn')}
            </Text>
          </Pressable>
        )}
      </SettingsSection>

      <SettingsSection
        title={t('settings.sections.about.title')}
        description={t('settings.sections.about.description')}
        sectionHeaderColor={sectionHeaderColor}
        isDark={isDark}
        rowBg={rowBg}
      >
        <SettingsRow
          icon="information-circle-outline"
          iconBgColor={colors.tint + '20'}
          iconColor={colors.tint}
          title={Constants.expoConfig?.name ?? appConfig?.appName ?? 'MF Project Tracker'}
          subtitle={[
            `v${Constants.expoConfig?.version ?? appConfig?.appVersion ?? '1.2.0'}${
              Platform.OS === 'ios' && Constants.expoConfig?.ios?.buildNumber != null
                ? ` (${Constants.expoConfig.ios.buildNumber})`
                : ''
            }${
              Platform.OS === 'android' && Constants.expoConfig?.android?.versionCode != null
                ? ` (${Constants.expoConfig.android.versionCode})`
                : ''
            }`,
            t('settings.sections.about.rowHint'),
          ].join('\n')}
          onPress={() => setShowAppInfoSheet(true)}
          rowBg={rowBg}
          titleColor={colors.bodyText}
          subtitleColor={colors.labelText}
          accessibilityLabel={`${Constants.expoConfig?.name ?? appConfig?.appName ?? 'MF Project Tracker'}, ${t('settings.sections.about.rowHint')}`}
        />
      </SettingsSection>

      <SettingsStoreBanner appConfig={appConfig} />
      <SettingsCursorBanner />

      <SignOutConfirmSheet
        visible={showSignOutSheet}
        onCancel={() => setShowSignOutSheet(false)}
        onConfirm={handleSignOutConfirm}
        isLoading={isLoading}
      />
      <AppInfoBottomSheet
        visible={showAppInfoSheet}
        onClose={() => setShowAppInfoSheet(false)}
        appConfig={appConfig}
      />
      <BroadcastNotificationSheet
        visible={showBroadcastSheet}
        onClose={() => setShowBroadcastSheet(false)}
      />
      <SendUserMessageSheet
        visible={showSendUserMessageSheet}
        onClose={() => setShowSendUserMessageSheet(false)}
      />
      <SendFeedbackBottomSheet
        visible={showFeedbackSheet}
        onClose={() => setShowFeedbackSheet(false)}
        onSubmitted={() => router.push('/feedback')}
      />
      <OTPBottomSheet
        visible={showOTPSheet}
        purpose="VERIFY_IDENTITY"
        skipRequest
        deliveryChannel={otpDeliveryChannel}
        onClose={() => {
          setShowOTPSheet(false);
          setOtpDeliveryChannel(null);
        }}
        onVerified={handleOTPVerified}
      />
      {otpRequestError ? (
        <MessageBottomSheet
          visible
          onDismiss={() => setOtpRequestError(null)}
          title={t('common.error')}
          message={otpRequestError}
          variant="error"
          primaryAction={okSheetAction(() => setOtpRequestError(null))}
        />
      ) : null}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  aboutIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  versionSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  otpDeliveryHint: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
    opacity: 0.92,
  },
});
