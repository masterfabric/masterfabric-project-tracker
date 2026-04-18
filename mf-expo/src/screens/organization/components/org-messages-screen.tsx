/**
 * Organization-wide chat tab: pick org (if several), list messages, composer, WS subscription.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { useKeyboard } from '@/src/shared/hooks/use-keyboard';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import {
  mfGoOrganizations,
  type OrganizationMessagePayload,
  type OrganizationPayload,
} from '@/src/shared/services/mf-go-api';
import { subscribeOrganizationMessages } from '@/src/shared/services/organization-message-subscription';
import { OrgMessageDetailSheet } from '@/src/screens/organization/components/org-message-detail-sheet';
import { useAppStore } from '@/src/shared/store';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useLocalSearchParams } from 'expo-router';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const LAST_ORG_CHAT_KEY = 'org_messages_last_org_id';

/** Shared tap target + row height so the composer input and Send align symmetrically. */
const COMPOSER_CONTROL_MIN_HEIGHT = 44;

/** Client-only flags for optimistic send UI (WhatsApp-style). */
type OrgChatMessageRow = OrganizationMessagePayload & {
  _sendState?: 'sending' | 'failed';
};

function calendarDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatOrgChatTime(iso: string, localeTag: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tag = localeTag.replace('_', '-');
  return d.toLocaleString(tag, { hour: '2-digit', minute: '2-digit' });
}

function daySeparatorKind(iso: string): 'today' | 'yesterday' | 'other' {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'other';
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const sd = start(d);
  const sn = start(now);
  const dayMs = 86_400_000;
  if (sd === sn) return 'today';
  if (sd === sn - dayMs) return 'yesterday';
  return 'other';
}

function formatDaySeparatorOther(iso: string, localeTag: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tag = localeTag.replace('_', '-');
  return d.toLocaleDateString(tag, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function OrgMessagesScreen() {
  const { orgId: paramOrgId } = useLocalSearchParams<{ orgId?: string }>();
  /** Tab bar is `position: 'absolute'` — pad content so composer is not under it. */
  const tabBarHeight = useBottomTabBarHeight();
  const { keyboardHeight } = useKeyboard();
  const keyboardOpen = keyboardHeight > 0;
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const textInputTheme = themedTextInputProps(colors, isDark);
  const onTint = foregroundOnTint(isDark);
  const user = useAppStore((s) => s.user);
  const authToken = useAppStore((s) => s.authToken);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { locale } = useLocale();

  const [orgs, setOrgs] = useState<OrganizationPayload[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OrgChatMessageRow[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [detailMessage, setDetailMessage] = useState<OrgChatMessageRow | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const loadOrgs = useCallback(async () => {
    if (!user) return;
    try {
      const list = await mfGoOrganizations.myOrganizations();
      setOrgs(list);
      let nextId: string | null = null;
      if (paramOrgId && list.some((o) => o.id === paramOrgId)) {
        nextId = paramOrgId;
      } else {
        const stored = await AsyncStorage.getItem(LAST_ORG_CHAT_KEY);
        if (stored && list.some((o) => o.id === stored)) {
          nextId = stored;
        } else if (list.length > 0) {
          nextId = list[0].id;
        }
      }
      setSelectedOrgId(nextId);
      if (nextId) await AsyncStorage.setItem(LAST_ORG_CHAT_KEY, nextId);
    } catch {
      setOrgs([]);
      setSelectedOrgId(null);
    } finally {
      setLoading(false);
    }
  }, [user, paramOrgId]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    loadOrgs();
  }, [isAuthenticated, user, loadOrgs]);

  const fetchMessages = useCallback(async (orgId: string) => {
    try {
      const list = await mfGoOrganizations.organizationMessages(orgId, 80);
      seenIds.current = new Set(list.map((m) => m.id));
      setMessages([...list].reverse());
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (!selectedOrgId) {
      setMessages([]);
      return;
    }
    fetchMessages(selectedOrgId);
  }, [selectedOrgId, fetchMessages]);

  useEffect(() => {
    if (!selectedOrgId || !authToken) return;
    const unsub = subscribeOrganizationMessages(authToken, selectedOrgId, (msg) => {
      setMessages((prev) => {
        const pendingIdx = prev.findIndex(
          (m) =>
            m.id.startsWith('local-') &&
            m._sendState === 'sending' &&
            m.authorUserID === msg.authorUserID &&
            m.body === msg.body
        );
        if (pendingIdx !== -1) {
          seenIds.current.add(msg.id);
          const next = [...prev];
          next[pendingIdx] = { ...msg };
          return next;
        }
        if (seenIds.current.has(msg.id)) return prev;
        seenIds.current.add(msg.id);
        return [...prev, msg];
      });
    });
    return unsub;
  }, [selectedOrgId, authToken]);

  const onSelectOrg = useCallback(async (id: string) => {
    setSelectedOrgId(id);
    await AsyncStorage.setItem(LAST_ORG_CHAT_KEY, id);
  }, []);

  const onSend = useCallback(async () => {
    if (!selectedOrgId || !body.trim() || sending || !user) return;
    const trimmed = body.trim();
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimistic: OrgChatMessageRow = {
      id: localId,
      organizationID: selectedOrgId,
      authorUserID: user.id,
      authorNickname: user.name?.trim() || '',
      body: trimmed,
      createdAt: new Date().toISOString(),
      _sendState: 'sending',
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody('');
    setSending(true);
    try {
      const msg = await mfGoOrganizations.postOrganizationMessage(selectedOrgId, trimmed);
      seenIds.current.add(msg.id);
      setMessages((prev) => prev.map((m) => (m.id === localId ? { ...msg } : m)));
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, _sendState: 'failed' } : m))
      );
    } finally {
      setSending(false);
    }
  }, [selectedOrgId, body, sending, user]);

  const displayMessages = useMemo(() => messages, [messages]);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId);
  const isOrgOwner = !!selectedOrg && !!user && selectedOrg.ownerUserID === user.id;

  const onMessageDeleted = useCallback((messageId: string) => {
    seenIds.current.delete(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  if (!user) {
    return null;
  }

  return (
    <>
    <AppBarScaffold
      style={styles.container}
      backgroundColor={colors.settingsBackground}
      appBar={
        <ScreenHeader
          title={t('tabs.orgMessages.title')}
          subtitle={
            selectedOrg
              ? selectedOrg.name
              : orgs.length === 0
                ? t('tabs.orgMessages.noOrgs')
                : t('tabs.orgMessages.pickOrg')
          }
          variant="minimal"
        />
      }
    >
        <AdaptiveKeyboardAvoidingView tabBarScene style={styles.flex}>
          {loading ? (
            <View style={[styles.centered, { paddingTop: 24 }]}>
              <ActivityIndicator color={colors.tint} size="large" />
              <Text style={[styles.waitingLabel, { color: colors.labelText }]}>
                {t('tabs.orgMessages.loading')}
              </Text>
            </View>
          ) : orgs.length === 0 ? (
            <View style={[styles.centered, { paddingTop: 24 }]}>
              <Text style={{ color: colors.labelText, textAlign: 'center' }}>
                {t('tabs.orgMessages.empty')}
              </Text>
            </View>
          ) : (
            <>
              {orgs.length > 1 && (
                <View
                  style={[
                    styles.orgPicker,
                    { borderBottomColor: isDark ? '#38383A' : '#C6C6C8', paddingTop: 12 },
                  ]}
                >
                  <FlatList
                    horizontal
                    data={orgs}
                    keyExtractor={(o) => o.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.orgPickerInner}
                    renderItem={({ item }) => {
                      const active = item.id === selectedOrgId;
                      return (
                        <Pressable
                          onPress={() => onSelectOrg(item.id)}
                          style={[
                            styles.orgChip,
                            {
                              backgroundColor: active ? colors.tint + '22' : colors.settingsBackground,
                              borderColor: active ? colors.tint : colors.surfaceBorder,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? colors.tint : colors.bodyText,
                              fontWeight: active ? '700' : '500',
                            }}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </Pressable>
                      );
                    }}
                  />
                </View>
              )}
              <FlatList
                data={displayMessages}
                keyExtractor={(m) => m.id}
                style={styles.flex}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.listContent,
                  {
                    paddingTop: 12,
                    paddingBottom: keyboardOpen ? 24 : 32 + tabBarHeight,
                  },
                ]}
                renderItem={({ item, index }) => {
                  const mine = item.authorUserID === user.id;
                  const theirsBg = isDark ? colors.surfaceBackground : '#E5E5EA';
                  const timeStr = formatOrgChatTime(item.createdAt, locale);
                  const sendFailed = mine && item._sendState === 'failed';
                  const sending = mine && item._sendState === 'sending';

                  const prev = index > 0 ? displayMessages[index - 1] : null;
                  const showDaySep =
                    !prev || calendarDayKey(item.createdAt) !== calendarDayKey(prev.createdAt);
                  const kind = showDaySep ? daySeparatorKind(item.createdAt) : null;
                  const dayLabel =
                    kind === 'today'
                      ? t('tabs.orgMessages.dayToday')
                      : kind === 'yesterday'
                        ? t('tabs.orgMessages.dayYesterday')
                        : kind === 'other'
                          ? formatDaySeparatorOther(item.createdAt, locale)
                          : '';

                  return (
                    <View>
                      {showDaySep ? (
                        <View style={styles.daySepWrap}>
                          <View
                            style={[
                              styles.daySepPill,
                              {
                                backgroundColor: colors.surfaceBackground,
                                borderWidth: StyleSheet.hairlineWidth,
                                borderColor: colors.surfaceBorder,
                              },
                            ]}
                          >
                            <Text style={[styles.daySepText, { color: colors.labelText }]}>
                              {dayLabel}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                      <View
                        style={[
                          styles.bubbleRow,
                          mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
                        ]}
                      >
                        <Pressable
                          onLongPress={() => setDetailMessage(item)}
                          delayLongPress={380}
                          style={({ pressed }) => [
                            styles.messageStack,
                            mine ? styles.messageStackMine : styles.messageStackTheirs,
                            pressed && styles.messageStackPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={t('tabs.orgMessages.a11yMessageBubble')}
                          accessibilityHint={t('tabs.orgMessages.a11yMessageLongPress')}
                        >
                          <View
                            style={[
                              styles.bubble,
                              {
                                backgroundColor: mine ? colors.tint : theirsBg,
                                borderWidth: mine ? 0 : StyleSheet.hairlineWidth,
                                borderColor: mine ? 'transparent' : colors.surfaceBorder,
                              },
                            ]}
                          >
                            {!mine ? (
                              <Text style={[styles.bubbleAuthor, { color: colors.labelText }]}>
                                @{item.authorNickname || item.authorUserID.slice(0, 8)}
                              </Text>
                            ) : null}
                            <Text
                              style={[
                                styles.bubbleBody,
                                { color: mine ? onTint : colors.bodyText },
                              ]}
                            >
                              {item.body}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.bubbleMetaOutside,
                              mine ? styles.bubbleMetaOutsideMine : styles.bubbleMetaOutsideTheirs,
                            ]}
                          >
                            <Text
                              style={[styles.bubbleTime, { color: colors.labelText }]}
                              numberOfLines={1}
                            >
                              {timeStr}
                            </Text>
                            {mine ? (
                              <>
                                {sendFailed ? (
                                  <Ionicons
                                    name="alert-circle"
                                    size={15}
                                    color={colors.errorColor || '#FF3B30'}
                                    accessibilityLabel={`${t('tabs.orgMessages.sendFailed')}. ${t('tabs.orgMessages.a11yFailed')}`}
                                  />
                                ) : sending ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={colors.tint}
                                    style={styles.bubbleSendingSpinner}
                                    accessibilityLabel={t('tabs.orgMessages.a11ySending')}
                                  />
                                ) : (
                                  <Ionicons
                                    name="checkmark-done"
                                    size={16}
                                    color={colors.tint}
                                    style={styles.bubbleSentIcon}
                                    accessibilityLabel={t('tabs.orgMessages.a11ySent')}
                                  />
                                )}
                              </>
                            ) : null}
                          </View>
                        </Pressable>
                      </View>
                    </View>
                  );
                }}
              />
              <View
                style={[
                  styles.composer,
                  {
                    borderTopColor: isDark ? '#38383A' : '#C6C6C8',
                    backgroundColor: colors.settingsBackground,
                    paddingBottom: keyboardOpen ? 10 : tabBarHeight,
                  },
                ]}
              >
                <TextInput
                  {...textInputTheme}
                  value={body}
                  onChangeText={setBody}
                  placeholder={t('tabs.orgMessages.placeholder')}
                  style={[
                    styles.input,
                    {
                      color: colors.bodyText,
                      borderColor: colors.surfaceBorder,
                      backgroundColor: colors.surfaceBackground,
                    },
                  ]}
                  multiline
                  maxLength={8000}
                  {...(Platform.OS === 'android'
                    ? { includeFontPadding: false, textAlignVertical: 'top' as const }
                    : {})}
                />
                <Pressable
                  onPress={onSend}
                  disabled={sending || !body.trim()}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    {
                      backgroundColor: colors.tint,
                      opacity: pressed || sending || !body.trim() ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.sendBtnText, { color: onTint }]}>{t('tabs.orgMessages.send')}</Text>
                </Pressable>
              </View>
            </>
          )}
        </AdaptiveKeyboardAvoidingView>
    </AppBarScaffold>
      {selectedOrgId ? (
        <OrgMessageDetailSheet
          visible={detailMessage != null}
          message={detailMessage}
          organizationId={selectedOrgId}
          isOrgOwner={isOrgOwner}
          locale={locale}
          onClose={() => setDetailMessage(null)}
          onDeleted={onMessageDeleted}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  waitingLabel: { fontSize: 15, textAlign: 'center' },
  orgPicker: { borderBottomWidth: StyleSheet.hairlineWidth },
  orgPickerInner: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  orgChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    maxWidth: 200,
  },
  listContent: { paddingHorizontal: 12 },
  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    overflow: 'hidden',
  },
  messageStack: { maxWidth: '82%', position: 'relative' },
  messageStackMine: { alignSelf: 'flex-end' },
  messageStackTheirs: { alignSelf: 'flex-start' },
  messageStackPressed: { opacity: 0.88 },
  daySepWrap: { alignItems: 'center', marginBottom: 8, paddingTop: 2 },
  daySepPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, maxWidth: '92%' },
  daySepText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  bubbleAuthor: { fontSize: 12, marginBottom: 4, fontWeight: '600' },
  bubbleBody: { fontSize: 16, lineHeight: 22 },
  bubbleMetaOutside: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  bubbleMetaOutsideMine: { justifyContent: 'flex-end' },
  bubbleMetaOutsideTheirs: { justifyContent: 'flex-start' },
  bubbleTime: { fontSize: 11, fontWeight: '500', opacity: 0.9 },
  bubbleSendingSpinner: { marginLeft: 2, transform: [{ scale: 0.75 }] },
  bubbleSentIcon: { opacity: 0.95, marginLeft: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: COMPOSER_CONTROL_MIN_HEIGHT,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
  },
  sendBtn: {
    minHeight: COMPOSER_CONTROL_MIN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sendBtnText: { fontWeight: '600', fontSize: 16, lineHeight: 22 },
});
