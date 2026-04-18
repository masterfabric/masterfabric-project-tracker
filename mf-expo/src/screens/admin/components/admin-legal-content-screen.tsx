/**
 * Admin — publish Help/FAQ and Privacy Policy Markdown (public app settings).
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
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { MessageBottomSheet, okSheetAction, type MessageSheetAction } from '@/src/shared/components/MessageBottomSheet';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import {
  PUBLIC_HELP_FAQ_MARKDOWN_KEY,
  PUBLIC_HELP_FAQ_MARKDOWN_KEY_TR,
  PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY,
  PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY_TR,
} from '@/src/shared/constants/public-legal-app-settings';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoAdmin } from '@/src/shared/services';
import { useAppStore } from '@/src/shared/store';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';

export function AdminLegalContentScreen() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [helpMd, setHelpMd] = useState('');
  const [helpMdTr, setHelpMdTr] = useState('');
  const [privacyMd, setPrivacyMd] = useState('');
  const [privacyMdTr, setPrivacyMdTr] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingHelp, setSavingHelp] = useState(false);
  const [savingHelpTr, setSavingHelpTr] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [savingPrivacyTr, setSavingPrivacyTr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'success' | 'error';
    primaryAction: MessageSheetAction;
  } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rows = await mfGoAdmin.appSettings();
      let help = '';
      let helpTr = '';
      let privacy = '';
      let privacyTr = '';
      for (const r of rows) {
        if (r.key === PUBLIC_HELP_FAQ_MARKDOWN_KEY) help = r.value ?? '';
        if (r.key === PUBLIC_HELP_FAQ_MARKDOWN_KEY_TR) helpTr = r.value ?? '';
        if (r.key === PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY) privacy = r.value ?? '';
        if (r.key === PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY_TR) privacyTr = r.value ?? '';
      }
      setHelpMd(help);
      setHelpMdTr(helpTr);
      setPrivacyMd(privacy);
      setPrivacyMdTr(privacyTr);
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

  const saveHelp = async () => {
    try {
      setSavingHelp(true);
      await mfGoAdmin.upsertAppSetting({
        key: PUBLIC_HELP_FAQ_MARKDOWN_KEY,
        value: helpMd,
        description: 'Public Help & FAQ (Markdown) for in-app /help-faq',
        isPublic: true,
      });
      setSheet({
        title: t('common.success'),
        message: t('settings.adminLegalContent.saved'),
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
      setSavingHelp(false);
    }
  };

  const saveHelpTr = async () => {
    try {
      setSavingHelpTr(true);
      await mfGoAdmin.upsertAppSetting({
        key: PUBLIC_HELP_FAQ_MARKDOWN_KEY_TR,
        value: helpMdTr,
        description: 'Public Help & FAQ — Turkish Markdown (mf-expo locale tr)',
        isPublic: true,
      });
      setSheet({
        title: t('common.success'),
        message: t('settings.adminLegalContent.saved'),
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
      setSavingHelpTr(false);
    }
  };

  const savePrivacy = async () => {
    try {
      setSavingPrivacy(true);
      await mfGoAdmin.upsertAppSetting({
        key: PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY,
        value: privacyMd,
        description: 'Public Privacy Policy (Markdown) for in-app /privacy-policy',
        isPublic: true,
      });
      setSheet({
        title: t('common.success'),
        message: t('settings.adminLegalContent.saved'),
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
      setSavingPrivacy(false);
    }
  };

  const savePrivacyTr = async () => {
    try {
      setSavingPrivacyTr(true);
      await mfGoAdmin.upsertAppSetting({
        key: PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY_TR,
        value: privacyMdTr,
        description: 'Public Privacy Policy — Turkish Markdown (mf-expo locale tr)',
        isPublic: true,
      });
      setSheet({
        title: t('common.success'),
        message: t('settings.adminLegalContent.saved'),
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
      setSavingPrivacyTr(false);
    }
  };

  const border = isDark ? '#38383A' : '#C6C6C8';
  const inputBg = isDark ? '#1C1C1E' : '#F2F2F7';

  if (!isAdmin) return null;

  return (
    <>
    <AppBarScaffold
      backgroundColor={colors.background}
      appBar={
        <ScreenHeader
          title={t('settings.adminLegalContent.title')}
          subtitle={t('settings.adminLegalContent.subtitle')}
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
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <Text style={[styles.err, { color: '#FF3B30' }]}>{error}</Text>
            ) : null}
            <Text style={[styles.hint, { color: colors.labelText }]}>
              {t('settings.adminLegalContent.keyHint')}
            </Text>

            <Text style={[styles.label, { color: colors.bodyText }]}>
              {t('settings.adminLegalContent.helpLabel')}
            </Text>
            <TextInput
              value={helpMd}
              onChangeText={setHelpMd}
              multiline
              textAlignVertical="top"
              placeholder="## Help…"
              placeholderTextColor={colors.labelText}
              style={[
                styles.area,
                {
                  color: colors.bodyText,
                  borderColor: border,
                  backgroundColor: inputBg,
                },
              ]}
            />
            <Pressable
              onPress={() => void saveHelp()}
              disabled={savingHelp}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : savingHelp ? 0.6 : 1 },
              ]}
            >
              {savingHelp ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={[styles.btnText, { color: onTint }]}>
                  {t('settings.adminLegalContent.saveHelp')}
                </Text>
              )}
            </Pressable>

            <Text style={[styles.label, styles.gap, { color: colors.bodyText }]}>
              {t('settings.adminLegalContent.helpLabelTurkish')}
            </Text>
            <TextInput
              value={helpMdTr}
              onChangeText={setHelpMdTr}
              multiline
              textAlignVertical="top"
              placeholder="## Yardım…"
              placeholderTextColor={colors.labelText}
              style={[
                styles.area,
                {
                  color: colors.bodyText,
                  borderColor: border,
                  backgroundColor: inputBg,
                },
              ]}
            />
            <Pressable
              onPress={() => void saveHelpTr()}
              disabled={savingHelpTr}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : savingHelpTr ? 0.6 : 1 },
              ]}
            >
              {savingHelpTr ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={[styles.btnText, { color: onTint }]}>
                  {t('settings.adminLegalContent.saveHelpTurkish')}
                </Text>
              )}
            </Pressable>

            <Text style={[styles.label, styles.gap, { color: colors.bodyText }]}>
              {t('settings.adminLegalContent.privacyLabel')}
            </Text>
            <TextInput
              value={privacyMd}
              onChangeText={setPrivacyMd}
              multiline
              textAlignVertical="top"
              placeholder="## Privacy…"
              placeholderTextColor={colors.labelText}
              style={[
                styles.area,
                {
                  color: colors.bodyText,
                  borderColor: border,
                  backgroundColor: inputBg,
                },
              ]}
            />
            <Pressable
              onPress={() => void savePrivacy()}
              disabled={savingPrivacy}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : savingPrivacy ? 0.6 : 1 },
              ]}
            >
              {savingPrivacy ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={[styles.btnText, { color: onTint }]}>
                  {t('settings.adminLegalContent.savePrivacy')}
                </Text>
              )}
            </Pressable>

            <Text style={[styles.label, styles.gap, { color: colors.bodyText }]}>
              {t('settings.adminLegalContent.privacyLabelTurkish')}
            </Text>
            <TextInput
              value={privacyMdTr}
              onChangeText={setPrivacyMdTr}
              multiline
              textAlignVertical="top"
              placeholder="## Gizlilik…"
              placeholderTextColor={colors.labelText}
              style={[
                styles.area,
                {
                  color: colors.bodyText,
                  borderColor: border,
                  backgroundColor: inputBg,
                },
              ]}
            />
            <Pressable
              onPress={() => void savePrivacyTr()}
              disabled={savingPrivacyTr}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : savingPrivacyTr ? 0.6 : 1 },
              ]}
            >
              {savingPrivacyTr ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={[styles.btnText, { color: onTint }]}>
                  {t('settings.adminLegalContent.savePrivacyTurkish')}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        )}
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
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  err: { marginBottom: 12, fontSize: 14 },
  hint: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  gap: { marginTop: 20 },
  area: {
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnText: { fontSize: 16, fontWeight: '700' },
});
