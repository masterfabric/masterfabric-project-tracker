/**
 * User: list feedback threads (GFG-24).
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { FeedbackThreadIdBadge } from '@/src/shared/components/FeedbackThreadIdBadge';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { mfGoFeedback, type FeedbackThreadPayload } from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { useThemeColors } from 'masterfabric-expo-core';

export function FeedbackListScreen() {
  const colors = useThemeColors();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  const [threads, setThreads] = useState<FeedbackThreadPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const list = await mfGoFeedback.myThreads();
      setThreads(list);
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
      setThreads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(tabs)/settings');
      return;
    }
    void load(false);
  }, [isAuthenticated, load]);

  const renderItem = useCallback(
    ({ item }: { item: FeedbackThreadPayload }) => (
      <Pressable
        onPress={() => router.push(`/feedback/${item.id}`)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surfaceBackground,
            borderColor: colors.surfaceBorder,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <FeedbackThreadIdBadge threadId={item.id} style={styles.idBadge} />
        <View style={styles.cardTop}>
          <Text style={[styles.subject, { color: colors.bodyText }]} numberOfLines={2}>
            {item.subject || t('support.feedback.defaultSubject')}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.labelText} />
        </View>
        <Text style={[styles.meta, { color: colors.labelText }]}>
          {new Date(item.updatedAt).toLocaleString()} · {item.messages.length}{' '}
          {t('support.feedback.messageCount')}
        </Text>
      </Pressable>
    ),
    [colors]
  );

  return (
    <AppBarScaffold
      style={styles.container}
      backgroundColor={colors.settingsBackground}
      appBar={
        <ScreenHeader
          title={t('support.feedback.listTitle')}
          subtitle={t('support.feedback.listSubtitle')}
          onBackPress={() => router.back()}
          showBackButton
          variant="minimal"
        />
      }
    >
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: '#FF3B30' }]}>{error}</Text>
          <Pressable onPress={() => void load(false)} style={styles.retryWrap}>
            <Text style={{ color: colors.tint, fontWeight: '600' }}>
              {t('support.feedback.retry')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.tint}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.labelText }]}>
              {t('support.feedback.emptyList')}
            </Text>
          }
        />
      )}
    </AppBarScaffold>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  idBadge: { marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { flex: 1, fontSize: 16, fontWeight: '600' },
  meta: { marginTop: 6, fontSize: 13 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { textAlign: 'center', marginBottom: 12 },
  retryWrap: { padding: 8 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 16 },
});
