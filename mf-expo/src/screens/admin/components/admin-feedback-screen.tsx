/**
 * Admin: list feedback threads and reply (GFG-24).
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import {
  MessageBottomSheet,
  okSheetAction,
  type MessageSheetAction,
} from '@/src/shared/components/MessageBottomSheet';
import { FeedbackThreadIdBadge } from '@/src/shared/components/FeedbackThreadIdBadge';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import {
  mfGoAdmin,
  type AdminFeedbackThreadPayload,
  type FeedbackAuthorRole,
} from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Sizing, useTheme, useThemeColors } from 'masterfabric-expo-core';

export function AdminFeedbackScreen() {
  const { isDark } = useTheme();
  const colors = useThemeColors();
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [rows, setRows] = useState<AdminFeedbackThreadPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<AdminFeedbackThreadPayload | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msgSheet, setMsgSheet] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'success' | 'error';
    primaryAction: MessageSheetAction;
    secondaryAction?: MessageSheetAction;
  } | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isAdmin) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const list = await mfGoAdmin.feedbackThreads(80);
      setRows(list);
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)/settings');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) void load(false);
  }, [isAdmin, load]);

  const closeDetail = useCallback(() => {
    setDetail(null);
    setReplyText('');
  }, []);

  const sendReply = useCallback(async () => {
    if (!detail) return;
    const msg = replyText.trim();
    if (!msg) return;
    setReplying(true);
    try {
      await mfGoAdmin.replyToFeedback(detail.thread.id, msg);
      setReplyText('');
      await load(true);
      const refreshed = (await mfGoAdmin.feedbackThreads(80)).find(
        (r) => r.thread.id === detail.thread.id
      );
      if (refreshed) setDetail(refreshed);
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
    } finally {
      setReplying(false);
    }
  }, [detail, replyText, load]);

  const performDeleteThread = useCallback(async () => {
    if (!detail) return;
    setDeleting(true);
    try {
      await mfGoAdmin.deleteFeedbackThread(detail.thread.id);
      closeDetail();
      await load(true);
      setMsgSheet({
        title: t('common.success'),
        message: t('settings.adminFeedback.deleteThreadSuccess'),
        variant: 'success',
        primaryAction: okSheetAction(() => setMsgSheet(null)),
      });
    } catch (e) {
      setMsgSheet({
        title: t('common.error'),
        message: getGraphQLErrorMessage(e),
        variant: 'error',
        primaryAction: okSheetAction(() => setMsgSheet(null)),
      });
    } finally {
      setDeleting(false);
    }
  }, [detail, load, closeDetail]);

  const confirmDeleteThread = useCallback(() => {
    setMsgSheet({
      title: t('settings.adminFeedback.deleteThreadTitle'),
      message: t('settings.adminFeedback.deleteThreadMessage'),
      variant: 'info',
      secondaryAction: {
        label: t('common.cancel'),
        onPress: () => setMsgSheet(null),
      },
      primaryAction: {
        label: t('settings.adminFeedback.deleteThreadConfirm'),
        destructive: true,
        onPress: () => {
          setMsgSheet(null);
          void performDeleteThread();
        },
      },
    });
  }, [performDeleteThread]);

  const renderItem = useCallback(
    ({ item }: { item: AdminFeedbackThreadPayload }) => (
      <Pressable
        onPress={() => setDetail(item)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surfaceBackground,
            borderColor: colors.surfaceBorder,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <FeedbackThreadIdBadge threadId={item.thread.id} style={styles.cardIdBadge} />
        <Text style={[styles.cardTitle, { color: colors.bodyText }]} numberOfLines={2}>
          {item.thread.subject || t('support.feedback.defaultSubject')}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.labelText }]} numberOfLines={1}>
          {item.userDisplayName} · {item.userEmail}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.labelText }]}>
          {new Date(item.thread.updatedAt).toLocaleString()}
        </Text>
      </Pressable>
    ),
    [colors]
  );

  return (
    <>
    <AppBarScaffold
      style={styles.container}
      backgroundColor={colors.settingsBackground}
      appBar={
        <ScreenHeader
          title={t('settings.adminFeedback.title')}
          subtitle={t('settings.adminFeedback.subtitle')}
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
      ) : error && rows.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: '#FF3B30', textAlign: 'center' }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.thread.id}
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
              {t('settings.adminFeedback.empty')}
            </Text>
          }
        />
      )}

      <Modal
        visible={detail !== null}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <View style={styles.detailOverlay}>
          <AdaptiveKeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.detailKeyboardView}
          >
            <View
              style={[
                styles.detailSheet,
                {
                  backgroundColor: colors.background,
                  paddingBottom: Math.max(insets.bottom, Sizing.padding.m),
                },
              ]}
            >
            <View style={styles.detailHeader}>
              <Text
                style={[styles.detailTitle, { color: colors.bodyText }]}
                numberOfLines={2}
              >
                {detail?.thread.subject || t('support.feedback.defaultSubject')}
              </Text>
              <Pressable onPress={closeDetail} hitSlop={12}>
                <Ionicons name="close" size={28} color={colors.bodyText} />
              </Pressable>
            </View>
            {detail ? (
              <FeedbackThreadIdBadge threadId={detail.thread.id} style={styles.detailIdBadge} />
            ) : null}
            <Text style={[styles.detailSub, { color: colors.labelText }]}>
              {detail?.userDisplayName} · {detail?.userEmail}
            </Text>

            <FlatList
              data={
                detail
                  ? [...detail.thread.messages].sort(
                      (a, b) =>
                        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    )
                  : []
              }
              keyExtractor={(m) => m.id}
              style={styles.msgList}
              renderItem={({ item: m }) => {
                const role: FeedbackAuthorRole = m.authorRole;
                const isUser = role === 'USER';
                return (
                  <View style={[styles.msgRow, isUser ? styles.msgUser : styles.msgAdmin]}>
                    <Text style={[styles.msgBadge, { color: colors.labelText }]}>
                      {isUser ? t('support.feedback.badgeUser') : t('support.feedback.badgeAdmin')}
                    </Text>
                    <View
                      style={[
                        styles.msgBubble,
                        {
                          backgroundColor: isUser
                            ? colors.tint + '18'
                            : colors.surfaceBackground,
                          borderColor: colors.surfaceBorder,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.bodyText }} selectable>
                        {m.body}
                      </Text>
                      <Text style={[styles.msgTime, { color: colors.labelText }]}>
                        {new Date(m.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />

            <Pressable
              onPress={confirmDeleteThread}
              disabled={deleting || replying}
              style={({ pressed }) => [
                styles.deleteBtn,
                {
                  borderColor: '#FF3B30',
                  opacity: pressed ? 0.85 : deleting || replying ? 0.45 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('settings.adminFeedback.deleteThreadA11y')}
            >
              {deleting ? (
                <ActivityIndicator color="#FF3B30" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  <Text style={styles.deleteBtnText}>
                    {t('settings.adminFeedback.deleteThread')}
                  </Text>
                </>
              )}
            </Pressable>

            <Text style={[styles.replyLabel, { color: colors.labelText }]}>
              {t('settings.adminFeedback.replyLabel')}
            </Text>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder={t('settings.adminFeedback.replyPlaceholder')}
              placeholderTextColor={colors.labelText}
              style={[
                styles.replyInput,
                {
                  color: colors.bodyText,
                  borderColor: colors.surfaceBorder,
                  backgroundColor: colors.surfaceBackground,
                },
              ]}
              multiline
              maxLength={8000}
              editable={!replying && !deleting}
            />
            <Pressable
              onPress={() => void sendReply()}
              disabled={replying || deleting || !replyText.trim()}
              style={({ pressed }) => [
                styles.replyBtn,
                {
                  backgroundColor: colors.tint,
                  opacity:
                    pressed ? 0.9 : replying || deleting || !replyText.trim() ? 0.5 : 1,
                },
              ]}
            >
              {replying ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={[styles.replyBtnText, { color: onTint }]}>
                  {t('settings.adminFeedback.sendReply')}
                </Text>
              )}
            </Pressable>
          </View>
          </AdaptiveKeyboardAvoidingView>
        </View>
      </Modal>
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
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardIdBadge: { marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  cardMeta: { fontSize: 13 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 16 },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailKeyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  detailIdBadge: { marginTop: 8, marginBottom: 4 },
  detailSub: { fontSize: 13, marginTop: 6, marginBottom: 12 },
  msgList: { maxHeight: 280 },
  msgRow: { marginBottom: 12, maxWidth: '95%' },
  msgUser: { alignSelf: 'flex-start' },
  msgAdmin: { alignSelf: 'flex-end' },
  msgBadge: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  msgBubble: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  msgTime: { fontSize: 11, marginTop: 6 },
  deleteBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteBtnText: { color: '#FF3B30', fontSize: 15, fontWeight: '600' },
  replyLabel: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  replyInput: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    textAlignVertical: 'top',
  },
  replyBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  replyBtnText: { fontWeight: '700', fontSize: 16 },
});
