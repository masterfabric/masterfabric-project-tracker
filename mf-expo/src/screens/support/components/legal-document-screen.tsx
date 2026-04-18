/**
 * Renders admin-published Markdown from public appSettings (no auth required).
 */

import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { MarkdownText } from '@/src/shared/components/MarkdownText';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import {
  PUBLIC_HELP_FAQ_MARKDOWN_KEY,
  PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY,
  resolvePublicLegalMarkdownKey,
} from '@/src/shared/constants/public-legal-app-settings';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { fetchAppConfig } from '@/src/shared/services/app-config-service';
import { t } from '@/src/shared/i18n';
import { useThemeColors } from 'masterfabric-expo-core';

export type LegalDocumentKind = 'faq' | 'privacy';

interface LegalDocumentScreenProps {
  kind: LegalDocumentKind;
}

export function LegalDocumentScreen({ kind }: LegalDocumentScreenProps) {
  /** Must use context colors so "System" appearance matches header and rest of app. */
  const colors = useThemeColors();
  const { locale } = useLocale();

  const baseKey =
    kind === 'faq' ? PUBLIC_HELP_FAQ_MARKDOWN_KEY : PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY;
  const title =
    kind === 'faq'
      ? t('settings.sections.support.help')
      : t('settings.sections.privacy.privacyPolicy');
  const subtitle =
    kind === 'faq'
      ? t('settings.sections.support.helpSubtitle')
      : t('settings.sections.privacy.privacyPolicySubtitle');

  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchAppConfig();
        const storageKey = resolvePublicLegalMarkdownKey(baseKey, locale, cfg.custom);
        const raw = cfg.custom[storageKey]?.trim() ?? '';
        if (!cancelled) setBody(raw);
      } catch {
        if (!cancelled) setBody('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseKey, locale]);

  const emptyCopy =
    kind === 'faq'
      ? t('support.legal.emptyFaq')
      : t('support.legal.emptyPrivacy');

  return (
    <AppBarScaffold
      style={styles.container}
      backgroundColor={colors.settingsBackground}
      appBar={
        <ScreenHeader
          title={title}
          subtitle={subtitle}
          onBackPress={() => router.back()}
          showBackButton
          variant="minimal"
        />
      }
    >
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.settingsBackground }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : body && body.length > 0 ? (
          <MarkdownText
            markdown={body}
            baseStyle={[styles.body, { color: colors.bodyText }]}
            selectable
          />
        ) : (
          <Text
            style={[styles.body, { color: colors.bodyText }]}
            selectable
          >
            {emptyCopy}
          </Text>
        )}
      </ScrollView>
    </AppBarScaffold>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  body: { fontSize: 16, lineHeight: 24 },
  centered: { paddingVertical: 32, alignItems: 'center' },
});
