/**
 * Admin — outbound SMTP (system_mail_smtp) and send test / user email.
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
import {
  MessageBottomSheet,
  okSheetAction,
  type MessageSheetAction,
} from '@/src/shared/components/MessageBottomSheet';
import {
  type MailSmtpProviderId,
  SMTP_PROVIDER_ORDER,
  getPresetForProvider,
  inferMailProviderFromEmail,
  inferMailProviderFromHost,
} from '@/src/screens/admin/utils/mail-smtp-presets';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoAdmin, type AdminMailSmtpSettings } from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';

const PROVIDER_LABEL_KEYS: Record<MailSmtpProviderId, string> = {
  gmail: 'settings.adminMailManagement.providerGmail',
  yandex: 'settings.adminMailManagement.providerYandex',
  outlook: 'settings.adminMailManagement.providerOutlook',
  icloud: 'settings.adminMailManagement.providerIcloud',
  custom: 'settings.adminMailManagement.providerCustom',
};

export function AdminMailManagementScreen() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [providerId, setProviderId] = useState<MailSmtpProviderId>('custom');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');

  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState('');
  const [subjectPrefix, setSubjectPrefix] = useState('MasterFabric');
  const [implicitTLS, setImplicitTLS] = useState(false);
  const [plainNoTLS, setPlainNoTLS] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(false);

  const [testTo, setTestTo] = useState('');
  const [sendUserId, setSendUserId] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');

  const [msgSheet, setMsgSheet] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'success' | 'error';
    primaryAction: MessageSheetAction;
    secondaryAction?: MessageSheetAction;
  } | null>(null);

  const showErr = (message: string) =>
    setMsgSheet({
      title: t('common.error'),
      message,
      variant: 'error',
      primaryAction: okSheetAction(() => setMsgSheet(null)),
    });

  const showOk = (message: string) =>
    setMsgSheet({
      title: t('common.success'),
      message,
      variant: 'success',
      primaryAction: okSheetAction(() => setMsgSheet(null)),
    });

  const applyProviderPreset = useCallback((id: MailSmtpProviderId) => {
    const preset = getPresetForProvider(id);
    if (!preset) return;
    setHost(preset.host);
    setPort(String(preset.port));
    setImplicitTLS(preset.implicitTLS);
    setPlainNoTLS(preset.plainNoTLS);
  }, []);

  const applyLoaded = useCallback(
    (s: AdminMailSmtpSettings) => {
      setEnabled(s.enabled);
      setHost(s.host ?? '');
      setPort(String(s.port ?? 587));
      setUsername(s.username ?? '');
      setPassword('');
      setFromAddress(s.fromAddress ?? '');
      setFromName(s.fromName ?? '');
      setSubjectPrefix(s.subjectPrefix || 'MasterFabric');
      setImplicitTLS(s.implicitTLS);
      setPlainNoTLS(s.plainNoTLS);
      setPasswordConfigured(!!s.passwordConfigured);
      const acc = (s.fromAddress || s.username || '').trim();
      setAccountEmail(acc);
      const inferred = inferMailProviderFromHost(s.host ?? '');
      setProviderId(s.host?.trim() ? inferred : 'custom');
    },
    []
  );

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await mfGoAdmin.mailSmtpSettings();
      applyLoaded(s);
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [applyLoaded]);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)/settings');
      return;
    }
    void load();
  }, [isAdmin, load]);

  const selectProvider = (id: MailSmtpProviderId) => {
    setProviderId(id);
    if (id !== 'custom') {
      applyProviderPreset(id);
    }
  };

  const onAccountEmailBlur = () => {
    const trimmed = accountEmail.trim();
    if (!trimmed) return;
    const inferred = inferMailProviderFromEmail(trimmed);
    if (inferred !== 'custom' && inferred !== providerId) {
      selectProvider(inferred);
    }
    setUsername(trimmed);
    setFromAddress(trimmed);
  };

  const onCustomUsernameBlur = () => {
    if (providerId !== 'custom') return;
    const trimmed = username.trim();
    if (!trimmed) return;
    const inferred = inferMailProviderFromEmail(trimmed);
    if (inferred !== 'custom') {
      setAccountEmail(trimmed);
      selectProvider(inferred);
    }
  };

  const effectiveSmtpForLocalCheck = useCallback(() => {
    const preset = getPresetForProvider(providerId);
    const hostVal = preset ? preset.host : host.trim();
    const portNum = preset ? preset.port : parseInt(port, 10);
    const fromVal =
      providerId !== 'custom'
        ? accountEmail.trim()
        : (fromAddress.trim() || username.trim());
    return { hostVal, portNum, fromVal, preset };
  }, [providerId, host, port, accountEmail, fromAddress, username]);

  const assertCanSendWithCurrentForm = (): boolean => {
    if (!enabled) {
      showErr(t('settings.adminMailManagement.testRequiresEnabled'));
      return false;
    }
    const { hostVal, portNum, fromVal } = effectiveSmtpForLocalCheck();
    if (!hostVal || !fromVal || (!getPresetForProvider(providerId) && (Number.isNaN(portNum) || portNum <= 0))) {
      showErr(t('settings.adminMailManagement.saveBeforeTest'));
      return false;
    }
    if (!passwordConfigured && password.trim() === '') {
      showErr(t('settings.adminMailManagement.passwordRequiredForDb'));
      return false;
    }
    return true;
  };

  const buildUpdatePayload = (passwordOverride?: string | null): Parameters<
    typeof mfGoAdmin.updateMailSmtpSettings
  >[0] | null => {
    const preset = getPresetForProvider(providerId);
    let hostVal = host.trim();
    let portNum = parseInt(port, 10);
    let implicit = implicitTLS;
    let plain = plainNoTLS;
    let userVal = username.trim();
    let fromAddr = fromAddress.trim();
    const fromNm = fromName.trim();

    if (providerId !== 'custom') {
      if (!preset) return null;
      hostVal = preset.host;
      portNum = preset.port;
      implicit = preset.implicitTLS;
      plain = preset.plainNoTLS;
      const acc = accountEmail.trim();
      if (!acc) {
        showErr(t('settings.adminMailManagement.accountEmailRequired'));
        return null;
      }
      userVal = acc;
      fromAddr = acc;
    } else {
      if (Number.isNaN(portNum) || portNum <= 0) {
        showErr(t('settings.adminMailManagement.portInvalid'));
        return null;
      }
      if (!hostVal) {
        showErr(t('settings.adminMailManagement.hostRequiredCustom'));
        return null;
      }
      if (!fromAddr) {
        fromAddr = userVal;
      }
      if (!fromAddr) {
        showErr(t('settings.adminMailManagement.fromRequiredCustom'));
        return null;
      }
    }

    if (enabled && !passwordConfigured && password.trim() === '' && passwordOverride === undefined) {
      showErr(t('settings.adminMailManagement.passwordRequiredForDb'));
      return null;
    }

    const input: Parameters<typeof mfGoAdmin.updateMailSmtpSettings>[0] = {
      enabled,
      host: hostVal,
      port: portNum,
      username: userVal,
      fromAddress: fromAddr,
      fromName: fromNm,
      subjectPrefix: subjectPrefix.trim() || 'MasterFabric',
      implicitTLS: implicit,
      plainNoTLS: plain,
    };

    if (passwordOverride !== undefined) {
      input.password = passwordOverride;
    } else if (password.trim() !== '') {
      input.password = password.trim();
    }

    return input;
  };

  const save = async () => {
    try {
      setSaving(true);
      const input = buildUpdatePayload();
      if (!input) return;
      const s = await mfGoAdmin.updateMailSmtpSettings(input);
      applyLoaded(s);
      setPassword('');
      showOk(t('settings.adminMailManagement.saved'));
    } catch (e) {
      showErr(getGraphQLErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    const to = testTo.trim();
    if (!to) {
      showErr(t('settings.adminMailManagement.testToRequired'));
      return;
    }
    if (!assertCanSendWithCurrentForm()) return;
    try {
      await mfGoAdmin.sendTestMail(to);
      showOk(t('settings.adminMailManagement.testSent'));
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (raw.includes('MAIL_SMTP_NOT_CONFIGURED')) {
        showErr(t('settings.adminMailManagement.saveBeforeTest'));
      } else {
        showErr(getGraphQLErrorMessage(e));
      }
    }
  };

  const clearStoredPassword = () => {
    setMsgSheet({
      title: t('settings.adminMailManagement.clearPasswordTitle'),
      message: t('settings.adminMailManagement.clearPasswordMessage'),
      variant: 'info',
      secondaryAction: {
        label: t('common.cancel'),
        onPress: () => setMsgSheet(null),
      },
      primaryAction: {
        label: t('settings.adminMailManagement.clearPasswordConfirm'),
        destructive: true,
        onPress: () => {
          setMsgSheet(null);
          void doClearPassword();
        },
      },
    });
  };

  const doClearPassword = async () => {
    try {
      setSaving(true);
      const input = buildUpdatePayload('');
      if (!input) return;
      const s = await mfGoAdmin.updateMailSmtpSettings(input);
      applyLoaded(s);
      setPassword('');
      showOk(t('settings.adminMailManagement.passwordCleared'));
    } catch (e) {
      showErr(getGraphQLErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const sendUser = async () => {
    const uid = sendUserId.trim();
    if (!uid) {
      showErr(t('settings.adminMailManagement.userIdRequired'));
      return;
    }
    const subj = sendSubject.trim();
    const body = sendBody.trim();
    if (!subj || !body) {
      showErr(t('settings.adminMailManagement.subjectBodyRequired'));
      return;
    }
    if (!assertCanSendWithCurrentForm()) return;
    try {
      await mfGoAdmin.sendUserEmail(uid, subj, body);
      showOk(t('settings.adminMailManagement.userMailSent'));
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (raw.includes('MAIL_SMTP_NOT_CONFIGURED')) {
        showErr(t('settings.adminMailManagement.saveBeforeTest'));
      } else {
        showErr(getGraphQLErrorMessage(e));
      }
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

  const chipBase = {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    marginBottom: 8,
  };

  if (!isAdmin) return null;

  return (
    <>
    <AppBarScaffold
      backgroundColor={colors.background}
      appBar={
        <ScreenHeader
          title={t('settings.adminMailManagement.headerTitle')}
          subtitle={t('settings.adminMailManagement.subtitle')}
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
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.hint, { color: colors.labelText }]}>
            {t('settings.adminMailManagement.fallbackHint')}
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.tint} style={styles.loader} />
          ) : null}
          {error ? <Text style={[styles.error, { color: '#FF3B30' }]}>{error}</Text> : null}

          {!loading && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.bodyText, marginTop: 8 }]}>
                {t('settings.adminMailManagement.quickSetupTitle')}
              </Text>
              <Text style={[styles.hint, { color: colors.labelText, marginBottom: 8 }]}>
                {t('settings.adminMailManagement.quickSetupHint')}
              </Text>

              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: colors.bodyText }]}>
                  {t('settings.adminMailManagement.enabled')}
                </Text>
                <Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: colors.tint }} />
              </View>

              <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                {t('settings.adminMailManagement.providerLabel')}
              </Text>
              <View style={styles.chipRow}>
                {SMTP_PROVIDER_ORDER.map((id) => {
                  const active = providerId === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => selectProvider(id)}
                      style={[
                        chipBase,
                        {
                          borderColor: active ? colors.tint : colors.separator,
                          backgroundColor: active
                            ? isDark
                              ? 'rgba(255,255,255,0.12)'
                              : 'rgba(0,0,0,0.06)'
                            : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? colors.tint : colors.bodyText,
                          fontSize: 14,
                          fontWeight: active ? '600' : '400',
                        }}
                      >
                        {t(PROVIDER_LABEL_KEYS[id])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {providerId === 'custom' ? (
                <Text style={[styles.warn, { color: colors.labelText }]}>
                  {t('settings.adminMailManagement.customProviderHint')}
                </Text>
              ) : null}

              <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                {t('settings.adminMailManagement.accountEmail')}
              </Text>
              <TextInput
                style={inputStyle}
                value={providerId !== 'custom' ? accountEmail : username}
                onChangeText={(text) => {
                 if (providerId !== 'custom') {
                    setAccountEmail(text);
                  } else {
                    setUsername(text);
                  }
                }}
                onBlur={() => {
                  if (providerId !== 'custom') {
                    onAccountEmailBlur();
                  } else {
                    onCustomUsernameBlur();
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder={t('settings.adminMailManagement.accountEmailPlaceholder')}
                placeholderTextColor={colors.labelText}
              />

              <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                {t('settings.adminMailManagement.password')}
                {passwordConfigured ? ` (${t('settings.adminMailManagement.passwordSet')})` : ''}
              </Text>
              <TextInput
                style={inputStyle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder={t('settings.adminMailManagement.passwordPlaceholder')}
                placeholderTextColor={colors.labelText}
              />
              {passwordConfigured ? (
                <Pressable onPress={clearStoredPassword} style={styles.clearPwd}>
                  <Text style={{ color: '#FF3B30', fontSize: 14 }}>
                    {t('settings.adminMailManagement.clearPassword')}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => setAdvancedOpen((v) => !v)}
                style={styles.advancedToggle}
              >
                <Text style={{ color: colors.tint, fontSize: 16, fontWeight: '600' }}>
                  {advancedOpen
                    ? t('settings.adminMailManagement.advancedToggleHide')
                    : t('settings.adminMailManagement.advancedToggleShow')}
                </Text>
              </Pressable>

              {advancedOpen ? (
                <>
                  {providerId === 'custom' ? (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                        {t('settings.adminMailManagement.fromAddress')}
                      </Text>
                      <TextInput
                        style={inputStyle}
                        value={fromAddress}
                        onChangeText={setFromAddress}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholder="noreply@yourdomain.com"
                        placeholderTextColor={colors.labelText}
                      />
                    </>
                  ) : (
                    <Text style={[styles.warn, { color: colors.labelText }]}>
                      {t('settings.adminMailManagement.advancedQuickLocked')}
                    </Text>
                  )}

                  <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                    {t('settings.adminMailManagement.host')}
                  </Text>
                  <TextInput
                    style={inputStyle}
                    value={host}
                    onChangeText={(text) => {
                      setHost(text);
                      if (providerId !== 'custom') {
                        setProviderId('custom');
                        const acc = accountEmail.trim();
                        if (acc) {
                          if (!username.trim()) setUsername(acc);
                          if (!fromAddress.trim()) setFromAddress(acc);
                        }
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="smtp.example.com"
                    placeholderTextColor={colors.labelText}
                  />

                  <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                    {t('settings.adminMailManagement.port')}
                  </Text>
                  <TextInput
                    style={inputStyle}
                    value={port}
                    onChangeText={setPort}
                    keyboardType="number-pad"
                    placeholderTextColor={colors.labelText}
                  />

                  {providerId === 'custom' ? (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                        {t('settings.adminMailManagement.username')}
                      </Text>
                      <TextInput
                        style={inputStyle}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholderTextColor={colors.labelText}
                      />
                    </>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                    {t('settings.adminMailManagement.fromName')}
                  </Text>
                  <TextInput
                    style={inputStyle}
                    value={fromName}
                    onChangeText={setFromName}
                    placeholderTextColor={colors.labelText}
                  />

                  <Text style={[styles.fieldLabel, { color: colors.labelText }]}>
                    {t('settings.adminMailManagement.subjectPrefix')}
                  </Text>
                  <TextInput
                    style={inputStyle}
                    value={subjectPrefix}
                    onChangeText={setSubjectPrefix}
                    placeholderTextColor={colors.labelText}
                  />

                  <View style={styles.rowBetween}>
                    <Text style={[styles.label, { color: colors.bodyText }]}>
                      {t('settings.adminMailManagement.implicitTLS')}
                    </Text>
                    <Switch
                      value={implicitTLS}
                      onValueChange={setImplicitTLS}
                      trackColor={{ true: colors.tint }}
                    />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.label, { color: colors.bodyText }]}>
                      {t('settings.adminMailManagement.plainNoTLS')}
                    </Text>
                    <Switch
                      value={plainNoTLS}
                      trackColor={{ true: colors.tint }}
                    />
                  </View>
                  <Text style={[styles.warn, { color: colors.labelText }]}>
                    {t('settings.adminMailManagement.plainNoTLSWarn')}
                  </Text>
                </>
              ) : null}

              <Pressable
                onPress={() => void save()}
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
                    {t('settings.adminMailManagement.save')}
                  </Text>
                )}
              </Pressable>

              <Text style={[styles.sectionTitle, { color: colors.bodyText }]}>
                {t('settings.adminMailManagement.testSection')}
              </Text>
              <TextInput
                style={inputStyle}
                value={testTo}
                onChangeText={setTestTo}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={t('settings.adminMailManagement.testToPlaceholder')}
                placeholderTextColor={colors.labelText}
              />
              <Pressable
                onPress={() => void sendTest()}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { borderColor: colors.tint, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>
                  {t('settings.adminMailManagement.sendTest')}
                </Text>
              </Pressable>

              <Text style={[styles.sectionTitle, { color: colors.bodyText }]}>
                {t('settings.adminMailManagement.userMailSection')}
              </Text>
              <TextInput
                style={inputStyle}
                value={sendUserId}
                onChangeText={setSendUserId}
                autoCapitalize="none"
                placeholder={t('settings.adminMailManagement.userIdPlaceholder')}
                placeholderTextColor={colors.labelText}
              />
              <TextInput
                style={inputStyle}
                value={sendSubject}
                onChangeText={setSendSubject}
                placeholder={t('settings.adminMailManagement.subjectPlaceholder')}
                placeholderTextColor={colors.labelText}
              />
              <TextInput
                style={[inputStyle, styles.bodyMultiline]}
                value={sendBody}
                onChangeText={setSendBody}
                multiline
                placeholder={t('settings.adminMailManagement.bodyPlaceholder')}
                placeholderTextColor={colors.labelText}
              />
              <Pressable
                onPress={() => void sendUser()}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { borderColor: colors.tint, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>
                  {t('settings.adminMailManagement.sendUser')}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBarScaffold>
    {msgSheet ? (
      <MessageBottomSheet
        visible
        onDismiss={() => setMsgSheet(null)}
        title={msgSheet.title}
        message={msgSheet.message}
        variant={msgSheet.variant}
        primaryAction={msgSheet.primaryAction}
        secondaryAction={msgSheet.secondaryAction}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  hint: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  loader: { marginVertical: 24 },
  error: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, marginTop: 12, marginBottom: 6 },
  label: { fontSize: 16, flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  advancedToggle: { marginTop: 16, marginBottom: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  bodyMultiline: { minHeight: 100, textAlignVertical: 'top' },
  warn: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  primaryBtn: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginTop: 28, marginBottom: 8 },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  clearPwd: { marginTop: 8, alignSelf: 'flex-start' },
});
