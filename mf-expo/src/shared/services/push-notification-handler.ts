/**
 * Push notifications — merge OneSignal-received items into the notification store.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { onesignalHelper } from 'masterfabric-expo-core';
import type { NotificationItem } from '@/src/screens/notifications/models/notification-models';
import { useNotificationStore } from '@/src/screens/notifications/store/notification-store';

const LOCAL_RECEIVED_IDS_KEY = '@notifications/received_locally';

function getNotificationId(notification: {
  notificationId?: string;
  additionalData?: Record<string, unknown>;
}): string | null {
  const data = notification.additionalData as Record<string, unknown> | undefined;
  const fromData = data?.notification_id ?? data?.notificationId;
  if (typeof fromData === 'string') return fromData;
  if (typeof notification.notificationId === 'string') return notification.notificationId;
  return null;
}

function pushToItem(notification: {
  notificationId?: string;
  title?: string;
  body?: string;
  additionalData?: Record<string, unknown>;
}): NotificationItem {
  const data = (notification.additionalData ?? {}) as Record<string, unknown>;
  const id = getNotificationId(notification) ?? notification.notificationId ?? `push-${Date.now()}`;
  const type = (data.type as NotificationItem['type']) || 'info';
  const category = (data.category as string) || 'app';

  return {
    id,
    title: (notification.title as string) || 'Notification',
    subtitle: data.subtitle as string | undefined,
    message: (notification.body as string) || '',
    timestamp: new Date(),
    isRead: false,
    type: ['info', 'warning', 'success', 'error'].includes(type) ? type : 'info',
    category,
    icon: data.icon as string | undefined,
    language: data.language as string | undefined,
    actionUrl: data.actionUrl as string | undefined,
    imageUrl: data.imageUrl as string | undefined,
    priority: ['high', 'normal', 'low'].includes(data.priority as string)
      ? (data.priority as NotificationItem['priority'])
      : undefined,
  };
}

async function markReceivedLocally(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_RECEIVED_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      await AsyncStorage.setItem(LOCAL_RECEIVED_IDS_KEY, JSON.stringify(ids));
    }
  } catch {
    /* ignore */
  }
}

export async function wasReceivedLocallyFirst(id: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_RECEIVED_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(id);
  } catch {
    return false;
  }
}

function addFromPush(notification: {
  notificationId?: string;
  title?: string;
  body?: string;
  additionalData?: Record<string, unknown>;
}): void {
  const item = pushToItem(notification);
  useNotificationStore.getState().upsertNotification(item);
  markReceivedLocally(item.id).catch(() => {});
}

let unsubForeground: (() => void) | null = null;
let unsubClick: (() => void) | null = null;

export function initPushNotificationHandler(): () => void {
  if (unsubForeground || unsubClick) {
    return () => {
      unsubForeground?.();
      unsubClick?.();
      unsubForeground = null;
      unsubClick = null;
    };
  }

  unsubForeground = onesignalHelper.addForegroundWillShowHandler((event) => {
    const notif = event?.notification as
      | (Parameters<typeof addFromPush>[0] & { display?: () => void })
      | undefined;
    if (!notif) return;
    addFromPush(notif);
    // OneSignal v5: OSNotification.display() is required for banner/sound while app is foregrounded.
    if (typeof notif.display === 'function') {
      notif.display();
    }
  });

  unsubClick = onesignalHelper.addNotificationClickListener((event) => {
    const notif = event?.notification;
    if (notif) addFromPush(notif);
  });

  return () => {
    unsubForeground?.();
    unsubClick?.();
    unsubForeground = null;
    unsubClick = null;
  };
}
