/**
 * Admin — edit published product version and Markdown changelog (mf-go productRelease).
 */

import { Ionicons } from '@expo/vector-icons';
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
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoAdmin, mfGoSettings } from '@/src/shared/services';
import { useAppStore } from '@/src/shared/store';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';

export function AdminVersionManagementScreen() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'success' | 'error';
    primaryAction: MessageSheetAction;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const pr = await mfGoSettings.productRelease();
      setVersion(pr.version);
      setChangelog(pr.changelogMarkdown);
      setUpdatedAt(pr.updatedAt);
      setUpdatedBy(pr.updatedByDisplayName ?? null);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const legacy =
        raw.includes('productRelease') ||
        raw.includes('Cannot query field') ||
        raw.includes('unknown field');
      setError(
        legacy ? t('settings.adminProductRelease.backendRequired') : getGraphQLErrorMessage(e)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)/settings');
      return;
    }
    load();
  }, [isAdmin, load]);

  const onSave = async () => {
    const v = version.trim();
    if (!v) {
      setSheet({
        title: t('common.error'),
        message: t('settings.adminProductRelease.versionRequired'),
        variant: 'error',
        primaryAction: okSheetAction(() => setSheet(null)),
      });
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const pr = await mfGoAdmin.updateProductRelease({
        version: v,
        changelogMarkdown: changelog.trim(),
      });
      setVersion(pr.version);
      setChangelog(pr.changelogMarkdown);
      setUpdatedAt(pr.updatedAt);
      setUpdatedBy(pr.updatedByDisplayName ?? null);
      setSheet({
        title: t('common.success'),
        message: t('settings.adminProductRelease.saved'),
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

  const border = isDark ? '#38383A' : '#C6C6C8';
  const inputBg = isDark ? '#1C1C1E' : '#F2F2F7';

  if (!isAdmin) return null;

  return (
    <>
    <AppBarScaffold
      backgroundColor={colors.background}
      appBar={
        <ScreenHeader
          title={t('settings.adminProductRelease.title')}
          onBackPress={() => router.back()}
          variant="minimal"
        />
      }
    >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          {loading ? (
            <View style={[styles.centered, { paddingTop: 24 }]}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingTop: 8 },
              ]}
              keyboardShouldPersistTaps="handled"
            >
            {error ? (
              <Text style={[styles.errorText, { color: '#FF3B30' }]}>{error}</Text>
            ) : null}
            {updatedAt && !error ? (
              <Text style={[styles.meta, { color: colors.labelText }]}>
                {t('settings.adminProductRelease.lastUpdated', {
                  at: new Date(updatedAt).toLocaleString(),
                  by: updatedBy || '—',
                })}
              </Text>
            ) : null}

            <Text style={[styles.label, { color: colors.labelText }]}>
              {t('settings.adminProductRelease.versionLabel')}
            </Text>
            <TextInput
              value={version}
              onChangeText={setVersion}
              placeholder="0.1.0"
              placeholderTextColor={colors.labelText}
              style={[
                styles.input,
                { color: colors.bodyText, backgroundColor: inputBg, borderColor: border },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.label, { color: colors.labelText, marginTop: 16 }]}>
              {t('settings.adminProductRelease.changelogLabel')}
            </Text>
            <Text style={[styles.hint, { color: colors.labelText }]}>
              {t('settings.adminProductRelease.changelogHint')}
            </Text>
            <TextInput
              value={changelog}
              onChangeText={setChangelog}
              placeholder={t('settings.adminProductRelease.changelogPlaceholder')}
              placeholderTextColor={colors.labelText}
              style={[
                styles.changelogInput,
                { color: colors.bodyText, backgroundColor: inputBg, borderColor: border },
              ]}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              onPress={onSave}
              disabled={saving || !!error}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor: colors.tint,
                  opacity: pressed || saving || error ? 0.75 : 1,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color={onTint} />
                  <Text style={[styles.saveBtnText, { color: onTint }]}>
                    {t('settings.adminProductRelease.save')}
                  </Text>
                </>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  meta: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  hint: { fontSize: 12, marginBottom: 8, lineHeight: 17 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  changelogInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 220,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveBtnText: { fontSize: 17, fontWeight: '600' },
  errorText: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
});
