/**
 * Notification service — thin wrapper over mf-go GraphQL API.
 */

import { mfGoNotifications, type NotificationPayload } from '@/src/shared/services/mf-go-api';
import { NotificationItem } from '../models/notification-models';

function toItem(p: NotificationPayload): NotificationItem {
  const priority = p.priority as NotificationItem['priority'] | undefined;
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle ?? undefined,
    message: p.message,
    timestamp: new Date(p.createdAt),
    isRead: p.isRead,
    type: (p.type as NotificationItem['type']) || 'info',
    category: p.category || 'app',
    icon: p.icon ?? undefined,
    language: p.language ?? undefined,
    actionUrl: p.actionUrl ?? undefined,
    imageUrl: p.imageUrl ?? undefined,
    priority: priority && ['high', 'normal', 'low'].includes(priority) ? priority : undefined,
  };
}

export const notificationService = {
  async fetchNotifications(
    _userId: string | null,
    options?: { language?: string; limit?: number }
  ): Promise<NotificationItem[]> {
    let list = await mfGoNotifications.list(options);
    // Fallback: if language filter returns empty, retry without filter (backend may exclude NULL language)
    if (list.length === 0 && options?.language) {
      list = await mfGoNotifications.list({ limit: options.limit });
    }
    return list.map(toItem);
  },

  /** Admin screen: full DB list (no language filter). Requires ADMIN JWT. */
  async fetchAdminNotifications(limit = 200): Promise<NotificationItem[]> {
    const list = await mfGoNotifications.adminList(limit);
    return list.map(toItem);
  },

  async markAsRead(notificationId: string, _userId: string): Promise<void> {
    await mfGoNotifications.markAsRead(notificationId);
  },

  async markAllAsRead(_userId: string): Promise<void> {
    await mfGoNotifications.markAllAsRead();
  },

  async adminClearAll(): Promise<void> {
    await mfGoNotifications.adminClearAll();
  },

  async adminDelete(notificationId: string): Promise<void> {
    await mfGoNotifications.adminDelete(notificationId);
  },

  async adminUpdate(
    id: string,
    input: Parameters<typeof mfGoNotifications.adminUpdate>[1]
  ): Promise<NotificationItem> {
    const p = await mfGoNotifications.adminUpdate(id, input);
    return toItem(p);
  },

  async adminCreate(input: {
    title: string;
    subtitle?: string;
    message: string;
    type?: string;
    category?: string;
    icon?: string;
    language?: string;
    actionUrl?: string;
    imageUrl?: string;
    priority?: string;
  }): Promise<NotificationItem> {
    const p = await mfGoNotifications.adminCreate(input);
    return toItem(p);
  },
};
