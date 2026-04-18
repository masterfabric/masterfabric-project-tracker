/**
 * User: single feedback thread timeline (GFG-24).
 */

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { FeedbackThreadIdBadge } from '@/src/shared/components/FeedbackThreadIdBadge';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { mfGoFeedback, type FeedbackAuthorRole } from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { useThemeColors } from 'masterfabric-expo-core';

export function FeedbackThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [messages, setMessages] = useState<
    { id: string; authorRole: FeedbackAuthorRole; body: string; createdAt: string }[]
  >([]);

  useEffect(() => {
    if (!isAuthenticated || !id) {
      if (!isAuthenticated) router.replace('/(tabs)/settings');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const threads = await mfGoFeedback.myThreads();
        const thread = threads.find((x) => x.id === id);
        if (cancelled) return;
        if (!thread) {
          setError(t('support.feedback.threadNotFound'));
          setSubject('');
          setMessages([]);
        } else {
          setSubject(thread.subject);
          setMessages(thread.messages);
        }
      } catch (e) {
        if (!cancelled) {
          setError(getGraphQLErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  const bubbles = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [messages]
  );

  return (
    <AppBarScaffold
      style={styles.container}
      backgroundColor={colors.settingsBackground}
      appBar={
        <ScreenHeader
          title={subject || t('support.feedback.threadTitle')}
          subtitle={t('support.feedback.threadSubtitle')}
          onBackPress={() => router.back()}
          showBackButton
          variant="minimal"
        />
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: '#FF3B30', textAlign: 'center' }}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.timeline}
          showsVerticalScrollIndicator={false}
        >
          {id ? <FeedbackThreadIdBadge threadId={id} style={styles.threadIdBanner} /> : null}
          {bubbles.map((m) => {
            const isUser = m.authorRole === 'USER';
            return (
              <View
                key={m.id}
                style={[
                  styles.row,
                  isUser ? styles.rowUser : styles.rowAdmin,
                ]}
              >
                <Text style={[styles.badge, { color: colors.labelText }]}>
                  {isUser ? t('support.feedback.badgeYou') : t('support.feedback.badgeTeam')}
                </Text>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isUser ? colors.tint + '22' : colors.surfaceBackground,
                      borderColor: colors.surfaceBorder,
                    },
                  ]}
                >
                  <Text style={[styles.body, { color: colors.bodyText }]} selectable>
                    {m.body}
                  </Text>
                  <Text style={[styles.time, { color: colors.labelText }]}>
                    {new Date(m.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </AppBarScaffold>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  timeline: { padding: 16, paddingBottom: 40 },
  threadIdBanner: { marginBottom: 8 },
  row: { marginBottom: 16, maxWidth: '92%' },
  rowUser: { alignSelf: 'flex-end' },
  rowAdmin: { alignSelf: 'flex-start' },
  badge: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  bubble: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  body: { fontSize: 16, lineHeight: 22 },
  time: { fontSize: 12, marginTop: 8 },
});
