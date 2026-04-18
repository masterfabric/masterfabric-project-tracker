/**
 * Local Notification Helper (Core) — stub.
 *
 * mf-expo uses **OneSignal only** for push. Task due-time delivery is not scheduled
 * on-device here; use OneSignal (e.g. server-scheduled) when implemented.
 */

import { Linking } from 'react-native';
import type { NotificationPermissionOptions, PermissionStatus } from './permissions/types';
import { permissionsHandler, showPermissionSettingsAlert, openAppSettings } from './permissions_handler_helper';
import { DEFAULT_CHANNEL_ID, DEFAULT_CHANNELS } from './notifications/constants';
import type {
  NotificationOptions,
  RecurringNotificationOptions,
  NotificationTrigger,
  TimeIntervalTrigger,
  DateTrigger,
  CalendarTrigger,
  RecurringTrigger,
  CategoryOptions,
  ChannelOptions,
  ScheduledNotification,
  NotificationSettings,
  Subscription,
  NotificationValidationResult,
  ReceivedListener,
  TappedListener,
  DismissedListener,
  ActionHandler,
} from './notifications/types';

const STUB_MSG =
  'Local scheduled notifications are not enabled in this app. Use OneSignal for push; due reminders are a separate product track.';

function isTimeIntervalTrigger(t: NotificationTrigger): t is TimeIntervalTrigger {
  return 'seconds' in t && typeof (t as TimeIntervalTrigger).seconds === 'number';
}

function isDateTrigger(t: NotificationTrigger): t is DateTrigger {
  return 'date' in t && t instanceof Object && (t as DateTrigger).date instanceof Date;
}

const actionHandlers = new Map<string, ActionHandler>();

class LocalNotificationHelper {
  async requestPermission(options?: NotificationPermissionOptions): Promise<PermissionStatus> {
    return permissionsHandler.request('notifications', options);
  }

  async checkPermission(): Promise<PermissionStatus> {
    return permissionsHandler.check('notifications');
  }

  async isPermissionGranted(): Promise<boolean> {
    const s = await this.checkPermission();
    return s.granted;
  }

  async schedule(_options: NotificationOptions): Promise<string> {
    throw new Error(STUB_MSG);
  }

  async scheduleRecurring(_options: RecurringNotificationOptions): Promise<string> {
    throw new Error(STUB_MSG);
  }

  async scheduleMultiple(_notifications: NotificationOptions[]): Promise<string[]> {
    throw new Error(STUB_MSG);
  }

  async cancel(_notificationId: string): Promise<void> {}

  async cancelAll(): Promise<void> {}

  async getAllScheduled(): Promise<ScheduledNotification[]> {
    return [];
  }

  async getScheduled(_notificationId: string): Promise<ScheduledNotification | null> {
    return null;
  }

  async setBadgeCount(_count: number): Promise<void> {}

  async getBadgeCount(): Promise<number> {
    return 0;
  }

  async clearBadge(): Promise<void> {}

  async setCategory(_options: CategoryOptions): Promise<void> {
    throw new Error(STUB_MSG);
  }

  async getCategories(): Promise<{ identifier: string; actions?: { identifier: string; buttonTitle: string }[] }[]> {
    return [];
  }

  async deleteCategory(_identifier: string): Promise<void> {}

  async createChannel(_options: ChannelOptions): Promise<void> {}

  async getChannels(): Promise<{ id: string; name: string; description?: string | null }[]> {
    return [];
  }

  async deleteChannel(_channelId: string): Promise<void> {}

  async ensureDefaultChannels(): Promise<void> {}

  addReceivedListener(_callback: ReceivedListener): Subscription {
    return { remove: () => {} };
  }

  addTappedListener(_callback: TappedListener): Subscription {
    return { remove: () => {} };
  }

  addDismissedListener(_callback: DismissedListener): Subscription {
    return { remove: () => {} };
  }

  addActionHandler(actionId: string, callback: ActionHandler): void {
    actionHandlers.set(actionId, callback);
  }

  removeActionHandler(actionId: string): void {
    actionHandlers.delete(actionId);
  }

  async isEnabled(): Promise<boolean> {
    return this.isPermissionGranted();
  }

  async getSettings(): Promise<NotificationSettings> {
    const perm = await this.checkPermission();
    const granted = perm.granted;
    return {
      permissions: {
        alert: granted,
        badge: granted,
        sound: granted,
      },
      status: granted ? 'granted' : perm.status === 'denied' ? 'denied' : 'unknown',
    };
  }

  async openSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch {
      await openAppSettings();
    }
  }

  showPermissionSettingsAlert(): void {
    showPermissionSettingsAlert('notifications');
  }

  validateNotification(options: NotificationOptions): NotificationValidationResult {
    const errors: string[] = [];
    if (!options.title?.trim()) errors.push('title is required');
    if (!options.body?.trim()) errors.push('body is required');
    if (!options.trigger) errors.push('trigger is required');
    if (isTimeIntervalTrigger(options.trigger) && options.trigger.seconds < 0) {
      errors.push('trigger.seconds must be >= 0');
    }
    if (isDateTrigger(options.trigger) && Number.isNaN(options.trigger.date.getTime())) {
      errors.push('trigger.date must be a valid Date');
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const localNotificationHelper = new LocalNotificationHelper();
export { LocalNotificationHelper };
export type { NotificationOptions, RecurringNotificationOptions, NotificationTrigger };
export {
  DEFAULT_CHANNELS,
  DEFAULT_CHANNEL_ID,
} from './notifications/constants';
export type { NotificationPermissionOptions } from './permissions/types';
export type {
  NotificationContent,
  ScheduledNotification,
  Notification,
  NotificationResponse,
  NotificationSettings,
  Subscription,
  NotificationValidationResult,
  CategoryOptions,
  ChannelOptions,
  Attachment,
  RecurringTrigger,
  CalendarTrigger,
  DateTrigger,
  TimeIntervalTrigger,
} from './notifications/types';
