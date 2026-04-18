/**
 * Admin — OTP email: enable/disable and plain-text templates (app_settings).
 */

import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import {
  MessageBottomSheet,
  okSheetAction,
  type MessageSheetAction,
} from '@/src/shared/components/MessageBottomSheet';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import {
  OTP_EMAIL_BODY_LOGIN_KEY,
  OTP_EMAIL_BODY_PASSWORD_RESET_KEY,
  OTP_EMAIL_ENABLED_KEY,
  OTP_EMAIL_SUBJECT_LOGIN_KEY,
  OTP_EMAIL_SUBJECT_PASSWORD_RESET_KEY,
} from '@/src/shared/constants/otp-mail-app-settings';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoAdmin } from '@/src/shared/services';
import { useAppStore } from '@/src/shared/store';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';

function parseEnabled(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  if (v === '' || v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  return true;
}

export function AdminOtpMailScreen() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mailEnabled, setMailEnabled] = useState(true);
  const [subjectLogin, setSubjectLogin] = useState('');
  const [bodyLogin, setBodyLogin] = useState('');
  const [subjectReset, setSubjectReset] = useState('');
  const [bodyReset, setBodyReset] = useState('');
  const [sheet, setSheet] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'success' | 'error';
    primaryAction: MessageSheetAction;
    secondaryAction?: MessageSheetAction;
  } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rows = await mfGoAdmin.appSettings();
      const map = new Map(rows.map((r) => [r.key, r.value ?? '']));
      const en = map.get(OTP_EMAIL_ENABLED_KEY) ?? '';
      setMailEnabled(parseEnabled(en === '' ? 'true' : en));
      setSubjectLogin(map.get(OTP_EMAIL_SUBJECT_LOGIN_KEY) ?? '');
      setBodyLogin(map.get(OTP_EMAIL_BODY_LOGIN_KEY) ?? '');
      setSubjectReset(map.get(OTP_EMAIL_SUBJECT_PASSWORD_RESET_KEY) ?? '');
      setBodyReset(map.get(OTP_EMAIL_BODY_PASSWORD_RESET_KEY) ?? '');
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)/settings');
      return;
    }
    void load();
  }, [isAdmin, load]);

  const saveKey = async (key: string, value: string, description: string) => {
    await mfGoAdmin.upsertAppSetting({
      key,
      value,
      description,
      isPublic: false,
    });
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      const enabledVal = mailEnabled ? 'true' : 'false';
      await saveKey(
        OTP_EMAIL_ENABLED_KEY,
        enabledVal,
        'When false, OTP email is disabled (both mode falls back to admin_panel).'
      );
      await saveKey(
        OTP_EMAIL_SUBJECT_LOGIN_KEY,
        subjectLogin,
        'Go text/template subject for login/identity OTP. Placeholders: .AppName .Code .PurposeHuman .ExpiryMinutes'
      );
      await saveKey(
        OTP_EMAIL_BODY_LOGIN_KEY,
        bodyLogin,
        'Go text/template body for login/identity OTP (plain text).'
      );
      await saveKey(
        OTP_EMAIL_SUBJECT_PASSWORD_RESET_KEY,
        subjectReset,
        'Go text/template subject for password-reset OTP.'
      );
      await saveKey(
        OTP_EMAIL_BODY_PASSWORD_RESET_KEY,
        bodyReset,
        'Go text/template body for password-reset OTP.'
      );
      await load();
      setSheet({
        title: t('common.success'),
        message: t('settings.adminOtpMail.saved'),
        variant: 'success',
        primaryAction: okSheetAction(() => setSheet(null)),
      });
    } catch (e) {
      setSheet({
        title: t('common.error'),
        message: getGraphQLErrorMessage(e),
        variant: 'error',
        primaryAction: okSheetAction(() => setSheet(null)),
      });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      borderColor: colors.separator,
      color: colors.bodyText,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
  ];

  if (!isAdmin) return null;

  return (
    <>
    <AppBarScaffold
      backgroundColor={colors.background}
      appBar={
        <ScreenHeader
          title={t('settings.adminOtpMail.headerTitle')}
          subtitle={t('settings.adminOtpMail.subtitle')}
          onBackPress={() => router.back()}
          variant="minimal"
        />
      }
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={72}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.hint, { color: colors.labelText }]}>
            {t('settings.adminOtpMail.placeholdersHint')}
          </Text>

          {loading ? <ActivityIndicator color={colors.tint} style={styles.loader} /> : null}
          {error ? <Text style={[styles.err, { color: '#FF3B30' }]}>{error}</Text> : null}

          {!loading && (
            <>
              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: colors.bodyText }]}>
                  {t('settings.adminOtpMail.mailEnabled')}
                </Text>
                <Switch
                  value={mailEnabled}
                  onValueChange={setMailEnabled}
                  trackColor={{ true: colors.tint }}
                />
              </View>
              <Text style={[styles.warn, { color: colors.labelText }]}>
                {t('settings.adminOtpMail.mailEnabledHint')}
              </Text>

              <Text style={[styles.section, { color: colors.bodyText }]}>
                {t('settings.adminOtpMail.sectionLogin')}
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                {t('settings.adminOtpMail.subjectLogin')}
              </Text>
              <TextInput
                style={inputStyle}
                value={subjectLogin}
                onChangeText={setSubjectLogin}
                placeholderTextColor={colors.labelText}
              />
              <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                {t('settings.adminOtpMail.bodyLogin')}
              </Text>
              <TextInput
                style={[inputStyle, styles.multiline]}
                value={bodyLogin}
                onChangeText={setBodyLogin}
                multiline
                placeholderTextColor={colors.labelText}
              />

              <Text style={[styles.section, { color: colors.bodyText }]}>
                {t('settings.adminOtpMail.sectionReset')}
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                {t('settings.adminOtpMail.subjectReset')}
              </Text>
              <TextInput
                style={inputStyle}
                value={subjectReset}
                onChangeText={setSubjectReset}
                placeholderTextColor={colors.labelText}
              />
              <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                {t('settings.adminOtpMail.bodyReset')}
              </Text>
              <TextInput
                style={[inputStyle, styles.multiline]}
                value={bodyReset}
                onChangeText={setBodyReset}
                multiline
                placeholderTextColor={colors.labelText}
              />

              <Pressable
                onPress={() => void saveAll()}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.tint, opacity: pressed || saving ? 0.85 : 1 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={onTint} />
                ) : (
                  <Text style={[styles.primaryBtnText, { color: onTint }]}>
                    {t('settings.adminOtpMail.save')}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBarScaffold>
    {sheet ? (
      <MessageBottomSheet
        visible
        onDismiss={() => setSheet(null)}
        title={sheet.title}
        message={sheet.message}
        variant={sheet.variant}
        primaryAction={sheet.primaryAction}
        secondaryAction={sheet.secondaryAction}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  hint: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  loader: { marginVertical: 24 },
  err: { marginBottom: 12 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  label: { fontSize: 16, flex: 1 },
  warn: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  section: { fontSize: 17, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  fieldLabel: { fontSize: 13, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  primaryBtn: {
    marginTop: 28,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '600' },
});
