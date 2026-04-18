/**
 * Notification screen — mf-go list, tabs, push hint, card list.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScaffoldMessage } from '@/src/shared/components';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { t } from '@/src/shared/i18n';
import { useTheme } from 'masterfabric-expo-core';
import { useNotificationViewModel } from '../hooks/use-notification-view-model';
import { NotificationTab } from '../models/notification-models';
import { useNotificationStore } from '../store/notification-store';
import { NotificationItemComponent } from './notification-item';
import { NotificationPushBanner } from './notification-push-banner';
import { NotificationSkeleton } from './notification-skeleton';
import { NotificationTabs } from './notification-tabs';

export function NotificationScreen() {
  const { isDark, colors } = useTheme();
  const onTint = foregroundOnTint(isDark);

  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [scaffoldMessage, setScaffoldMessage] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  const {
    notifications,
    totalCount,
    unreadCount,
    tabUnreadCounts,
    isLoading,
    isRefreshing,
    markAsRead,
    markAllAsRead,
    clearAll,
    refreshNotifications,
    removeNotification,
    tabs,
  } = useNotificationViewModel(activeTab);

  const error = useNotificationStore((s) => s.error);

  const headerSubtitle = useMemo(() => {
    if (totalCount === 0 && !isLoading) return t('notifications.subtitle');
    if (unreadCount > 0) return t('notifications.unreadCount', { count: unreadCount });
    return t('notifications.allRead');
  }, [totalCount, unreadCount, isLoading]);

  const handleNotificationPress = (n: { id: string; isRead: boolean }) => {
    if (!n.isRead) markAsRead(n.id);
  };

  const handleNotificationDelete = (n: { id: string }) => {
    removeNotification(n.id);
    setScaffoldMessage({ visible: true, message: t('notifications.deletedMessage'), type: 'success' });
  };

  const showSkeleton = isLoading && totalCount === 0;
  const showEmpty = !isLoading && notifications.length === 0;
  const emptyForTabOnly = showEmpty && totalCount > 0 && activeTab !== 'all';

  return (
    <>
      <AppBarScaffold
        backgroundColor={colors.background}
        appBar={
          <View style={[styles.headerBlock, { borderBottomColor: colors.surfaceBorder }]}>
            <View style={[styles.headerGradient, { backgroundColor: colors.background }]}>
              <ScreenHeader
                title={t('notifications.title')}
                subtitle={headerSubtitle}
                showStageBadge={false}
                variant="minimal"
              />
            </View>
            <NotificationPushBanner colors={colors} isDark={isDark} />
            <NotificationTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              tabs={tabs}
              tabUnreadCounts={tabUnreadCounts}
            />
            {totalCount > 0 && (
              <View style={[styles.actionBar, { borderTopColor: colors.surfaceBorder }]}>
                <TouchableOpacity
                  onPress={markAllAsRead}
                  style={[styles.actionBtn, { backgroundColor: colors.tint + '14' }]}
                >
                  <Ionicons name="checkmark-done" size={16} color={colors.tint} />
                  <Text style={[styles.actionBtnText, { color: colors.tint }]}>
                    {t('notifications.markAllRead')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={clearAll}
                  style={[styles.actionBtn, { backgroundColor: colors.errorColor + '12' }]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.errorColor} />
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
                    <Ionicons name="alert-circle-outline" size={36} color={colors.errorColor} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {t('notifications.error.title')}
                  </Text>
                  <Text style={[styles.emptyMsg, { color: colors.labelText }]}>{error}</Text>
                  <TouchableOpacity
                    onPress={refreshNotifications}
                    style={[styles.retryBtn, { backgroundColor: colors.tint }]}
                  >
                    <Text style={[styles.retryTextLight, { color: onTint }]}>
                      {t('common.retry')}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : emptyForTabOnly ? (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.tint + '14' }]}>
                    <Ionicons
                      name={activeTab === 'app' ? 'apps-outline' : 'shield-checkmark-outline'}
                      size={36}
                      color={colors.tint}
                    />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {activeTab === 'app'
                      ? t('notifications.empty.appTab')
                      : t('notifications.empty.systemTab')}
                  </Text>
                  <Text style={[styles.emptyMsg, { color: colors.labelText }]}>
                    {t('notifications.empty.switchTabHint')}
                  </Text>
                </>
              ) : (
                <>
                  <View style={[styles.emptyIconLarge, { backgroundColor: colors.tint + '12' }]}>
                    <Ionicons name="notifications-off-outline" size={44} color={colors.tint} />
                  </View>
                  <Text style={[styles.emptyTitleLarge, { color: colors.text }]}>
                    {t('notifications.empty.title')}
                  </Text>
                  <Text style={[styles.emptyMsg, { color: colors.labelText }]}>
                    {t('notifications.empty.message')}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                { paddingTop: 6 },
              ]}
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
                />
              )}
              style={styles.list}
            />
          )}
      </AppBarScaffold>

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
  headerGradient: {
    paddingBottom: 2,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyTitleLarge: { fontSize: 19, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  emptyMsg: { fontSize: 15, textAlign: 'center', lineHeight: 22, opacity: 0.88 },
  retryBtn: { marginTop: 20, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  retryTextLight: { fontSize: 15, fontWeight: '600' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingBottom: 28 },
});
