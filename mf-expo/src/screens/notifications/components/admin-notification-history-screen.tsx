/**
 * Admin notification history — dedicated view for admins to see all broadcast notifications.
 * Separate from the user notification view.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScaffoldMessage } from '@/src/shared/components';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { useAppStore } from '@/src/shared/store';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { useTheme } from 'masterfabric-expo-core';
import { notificationService } from '../services/notification-service';
import { AdminEditNotificationModal } from './admin-edit-notification-modal';
import { NotificationItemComponent } from './notification-item';
import { NotificationSkeleton } from './notification-skeleton';
import type { NotificationItem } from '../models/notification-models';

export function AdminNotificationHistoryScreen() {
  const { isDark, colors } = useTheme();
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [scaffoldMessage, setScaffoldMessage] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });
  const [editItem, setEditItem] = useState<NotificationItem | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)/settings');
    }
  }, [isAdmin]);

  const fetchAdminList = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const list = await notificationService.fetchAdminNotifications(200);
      setNotifications(list);
    } catch (e) {
      console.error('[AdminNotificationHistory] Fetch failed:', e);
      setError(getGraphQLErrorMessage(e));
      setNotifications([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void fetchAdminList(false);
    }
  }, [isAdmin, fetchAdminList]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      const userId = useAppStore.getState().user?.id;
      if (userId) await notificationService.markAsRead(id, userId);
    } catch (e) {
      console.error('[AdminNotificationHistory] markAsRead:', e);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      const userId = useAppStore.getState().user?.id;
      if (userId) await notificationService.markAllAsRead(userId);
    } catch (e) {
      console.error('[AdminNotificationHistory] markAllAsRead:', e);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const refreshNotifications = useCallback(() => fetchAdminList(true), [fetchAdminList]);

  const handleNotificationPress = (n: { id: string; isRead: boolean }) => {
    if (!n.isRead) markAsRead(n.id);
  };

  const handleSaveEdit = async (id: string, input: Record<string, string>) => {
    const updated = await notificationService.adminUpdate(id, {
      title: input.title,
      subtitle: input.subtitle?.trim() ? input.subtitle : undefined,
      message: input.message,
      type: input.type,
      category: input.category,
      icon: input.icon,
      language: input.language,
      actionUrl: input.actionUrl || undefined,
      imageUrl: input.imageUrl || undefined,
      priority: input.priority,
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
    setScaffoldMessage({
      visible: true,
      message: t('settings.adminNotificationHistory.updatedMessage'),
      type: 'success',
    });
  };

  const handleNotificationDelete = async (n: { id: string }) => {
    try {
      await notificationService.adminDelete(n.id);
      removeNotification(n.id);
      setScaffoldMessage({ visible: true, message: t('notifications.deletedMessage'), type: 'success' });
    } catch (e) {
      setScaffoldMessage({
        visible: true,
        message: getGraphQLErrorMessage(e),
        type: 'error',
      });
    }
  };

  const handleAdminClearAll = async () => {
    try {
      await notificationService.adminClearAll();
      clearAll();
      setScaffoldMessage({
        visible: true,
        message: t('settings.adminNotificationHistory.clearedMessage'),
        type: 'success',
      });
    } catch (e) {
      setScaffoldMessage({
        visible: true,
        message: getGraphQLErrorMessage(e),
        type: 'error',
      });
    }
  };

  const showSkeleton = isLoading && notifications.length === 0;
  const showEmpty = !isLoading && notifications.length === 0;

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <AppBarScaffold
        backgroundColor={colors.background}
        appBar={
          <View style={[styles.headerBlock, { borderBottomColor: colors.surfaceBorder }]}>
            <ScreenHeader
              title={t('settings.adminNotificationHistory.headerTitle')}
              subtitle={
                notifications.length > 0
                  ? t('settings.adminNotificationHistory.countSubtitle', { count: notifications.length })
                  : t('settings.adminNotificationHistory.headerSubtitle')
              }
              showStageBadge={false}
              variant="minimal"
            />
            {notifications.length > 0 && (
              <View style={[styles.actionBar, { borderTopColor: colors.surfaceBorder }]}>
                <TouchableOpacity
                  onPress={markAllAsRead}
                  style={[styles.actionBtn, { backgroundColor: colors.tint + '12' }]}
                >
                  <Ionicons name="checkmark-done" size={14} color={colors.tint} />
                  <Text style={[styles.actionBtnText, { color: colors.tint }]}>
                    {t('notifications.markAllRead')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAdminClearAll}
                  style={[styles.actionBtn, { backgroundColor: colors.errorColor + '12' }]}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.errorColor} />
                  <Text style={[styles.actionBtnText, { color: colors.errorColor }]}>
                    {t('notifications.clearAll')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      >
          {showSkeleton ? (
            <View style={{ flex: 1 }}>
              <NotificationSkeleton />
            </View>
          ) : showEmpty ? (
            <View style={[styles.empty, { flex: 1 }]}>
              {error ? (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.errorColor + '20' }]}>
                    <Ionicons name="alert-circle-outline" size={28} color={colors.errorColor} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {t('notifications.error.title')}
                  </Text>
                  <Text style={[styles.emptyMsg, { color: colors.labelText }]}>{error}</Text>
                  <TouchableOpacity
                    onPress={refreshNotifications}
                    style={[styles.retryBtn, { backgroundColor: colors.tint + '20' }]}
                  >
                    <Text style={[styles.retryText, { color: colors.tint }]}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.tint + '15' }]}>
                    <Ionicons name="megaphone-outline" size={28} color={colors.tint} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {t('settings.adminNotificationHistory.emptyTitle')}
                  </Text>
                  <Text style={[styles.emptyMsg, { color: colors.labelText }]}>
                    {t('settings.adminNotificationHistory.emptyMessage')}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 28 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={refreshNotifications}
                  tintColor={colors.tint}
                />
              }
              renderItem={({ item }) => (
                <NotificationItemComponent
                  notification={item}
                  onPress={handleNotificationPress}
                  onDelete={handleNotificationDelete}
                  onEdit={(n) => setEditItem(n)}
                />
              )}
              style={styles.list}
            />
          )}
      </AppBarScaffold>

      <AdminEditNotificationModal
        visible={editItem !== null}
        notification={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSaveEdit}
      />

      <ScaffoldMessage
        visible={scaffoldMessage.visible}
        message={scaffoldMessage.message}
        type={scaffoldMessage.type}
        onHide={() => setScaffoldMessage((p) => ({ ...p, visible: false }))}
        icon="trash"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyMsg: { fontSize: 14, textAlign: 'center', opacity: 0.8 },
  retryBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  retryText: { fontSize: 14, fontWeight: '600' },
  list: { flex: 1 },
});
