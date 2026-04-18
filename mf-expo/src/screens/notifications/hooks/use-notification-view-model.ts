/**
 * Notification view model — fetches from mf-go, merges push-received items.
 */

import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { getCurrentLocale, t } from '@/src/shared/i18n';
import { useAppStore } from '@/src/shared/store';
import { wasReceivedLocallyFirst } from '@/src/shared/services/push-notification-handler';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import {
  NotificationItem,
  NotificationTab,
  TabItem,
} from '../models/notification-models';
import { notificationService } from '../services/notification-service';
import { useNotificationStore } from '../store/notification-store';

function notificationMatchesTab(n: NotificationItem, tab: NotificationTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'app') {
    return n.category === 'app' || n.type === 'info' || n.type === 'success';
  }
  return n.category === 'system' || n.type === 'warning' || n.type === 'error';
}

export function useNotificationViewModel(activeTab: NotificationTab = 'all') {
  const {
    notifications,
    unreadCount,
    isLoading,
    setNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    setLoading,
    setError,
    refreshRequestedAt,
    clearRefreshRequested,
  } = useNotificationStore();

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchNotifications = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const userId = useAppStore.getState().user?.id ?? null;
      const language = getCurrentLocale();
      // notificationService already applies language on the server and retries without
      // language if the filtered result is empty — do not filter again here or we drop
      // those fallback rows when DB language != app locale (e.g. en notification, tr app).
      const list = await notificationService.fetchNotifications(userId, { language });
      const fetchedIds = new Set(list.map((n) => n.id));
      const localNotifications = useNotificationStore.getState().notifications;
      const localToAdd: NotificationItem[] = [];
      for (const local of localNotifications) {
        if (fetchedIds.has(local.id)) continue;
        const receivedFirst = await wasReceivedLocallyFirst(local.id);
        if (receivedFirst && (!local.language || local.language === language)) {
          localToAdd.push(local);
        }
      }
      const merged = [...list, ...localToAdd].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      setNotifications(merged);
    } catch (err) {
      console.error('[NotificationViewModel] Fetch failed:', err);
      setError(getGraphQLErrorMessage(err));
      setNotifications([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [setLoading, setNotifications, setError]);

  const filteredNotifications = useMemo(
    () => notifications.filter((n) => notificationMatchesTab(n, activeTab)),
    [notifications, activeTab]
  );

  const tabUnreadCounts = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead);
    const countFor = (tab: NotificationTab) =>
      unread.filter((n) => notificationMatchesTab(n, tab)).length;
    return {
      all: unread.length,
      app: countFor('app'),
      system: countFor('system'),
    } satisfies Record<NotificationTab, number>;
  }, [notifications]);

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      markAsRead(id);
      try {
        const userId = useAppStore.getState().user?.id;
        if (userId) await notificationService.markAsRead(id, userId);
      } catch (e) {
        console.error('[NotificationViewModel] markAsRead:', e);
      }
    },
    [markAsRead]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    markAllAsRead();
    try {
      const userId = useAppStore.getState().user?.id;
      if (userId) await notificationService.markAllAsRead(userId);
    } catch (e) {
      console.error('[NotificationViewModel] markAllAsRead:', e);
    }
  }, [markAllAsRead]);

  const refreshNotifications = useCallback(
    () => fetchNotifications(true),
    [fetchNotifications]
  );

  useEffect(() => {
    fetchNotifications(false);
  }, [fetchNotifications]);

  useEffect(() => {
    if (refreshRequestedAt) {
      clearRefreshRequested();
      fetchNotifications(true);
    }
  }, [refreshRequestedAt, clearRefreshRequested, fetchNotifications]);

  const tabs: TabItem[] = [
    { key: 'all', label: t('notifications.tabs.all') },
    { key: 'app', label: t('notifications.tabs.app') },
    { key: 'system', label: t('notifications.tabs.system') },
  ];

  return {
    notifications: filteredNotifications,
    totalCount: notifications.length,
    unreadCount,
    tabUnreadCounts,
    isLoading,
    isRefreshing,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    removeNotification,
    clearAll,
    refreshNotifications,
    tabs,
  };
}

export function useNotificationItemTheme() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const getIconColor = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return colors.successColor;
      case 'warning':
        return colors.warningColor;
      case 'error':
        return colors.errorColor;
      default:
        return colors.tint;
    }
  };

  const getGradientColors = (type: NotificationItem['type']): [string, string] => {
    const c = getIconColor(type);
    return isDark ? [`${c}20`, `${c}10`] : [`${c}15`, `${c}08`];
  };

  return { isDark, colors, getIconColor, getGradientColors };
}

export function useNotificationItemTime() {
  const formatTime = (date: Date) => {
    const d = (Date.now() - date.getTime()) / 1000;
    if (d < 60) return t('notifications.justNow');
    if (d < 3600) return t('notifications.minutesAgo', { count: Math.floor(d / 60) });
    if (d < 86400) return t('notifications.hoursAgo', { count: Math.floor(d / 3600) });
    return t('notifications.daysAgo', { count: Math.floor(d / 86400) });
  };
  return { formatTime };
}

export function useNotificationItemGesture(
  notification: NotificationItem,
  onDelete?: (n: NotificationItem) => void
) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const gestureHandler = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-20, 20])
    .shouldCancelWhenOutside(true)
    .onUpdate((e) => {
      if (Math.abs(e.velocityX) > Math.abs(e.velocityY) && e.translationX < 0) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      const shouldDelete =
        Math.abs(e.translationX) > Math.abs(e.translationY) && e.translationX < -100;
      if (shouldDelete && onDelete) {
        const cb = onDelete;
        translateX.value = withSpring(-400);
        opacity.value = withSpring(0, undefined, () => runOnJS(cb)(notification));
      } else {
        translateX.value = withSpring(0);
        opacity.value = withSpring(1);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return { gestureHandler, animatedStyle };
}
