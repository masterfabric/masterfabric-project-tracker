import { create } from 'zustand';
import { NotificationItem, NotificationState } from '../models/notification-models';

interface NotificationStoreState extends NotificationState {
  /** Error message when fetch fails */
  error: string | null;
  /** When set, notification view should refresh (e.g. after admin broadcast) */
  refreshRequestedAt: number | null;
  setNotifications: (notifications: NotificationItem[]) => void;
  addNotification: (notification: NotificationItem) => void;
  upsertNotification: (notification: NotificationItem) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  requestRefresh: () => void;
  clearRefreshRequested: () => void;
}

const initialState = {
  notifications: [] as NotificationItem[],
  unreadCount: 0,
  isLoading: false,
  lastUpdated: null as Date | null,
  refreshRequestedAt: null as number | null,
  error: null as string | null,
};

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  ...initialState,
  
  setNotifications: (notifications: NotificationItem[]) => {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    set({ 
      notifications, 
      unreadCount,
      lastUpdated: new Date()
    });
  },
  
  addNotification: (notification: NotificationItem) => {
    const { notifications } = get();
    const newNotifications = [notification, ...notifications];
    const unreadCount = newNotifications.filter(n => !n.isRead).length;

    set({
      notifications: newNotifications,
      unreadCount,
      lastUpdated: new Date(),
    });
  },

  upsertNotification: (notification: NotificationItem) => {
    const { notifications } = get();
    const existing = notifications.find((n) => n.id === notification.id);
    let next: NotificationItem[];
    if (existing) {
      next = notifications.map((n) =>
        n.id === notification.id
          ? { ...notification, isRead: existing.isRead || notification.isRead }
          : n
      );
    } else {
      next = [notification, ...notifications];
    }
    const unreadCount = next.filter((n) => !n.isRead).length;
    set({ notifications: next, unreadCount, lastUpdated: new Date() });
  },

  markAsRead: (id: string) => {
    const { notifications } = get();
    const updatedNotifications = notifications.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    );
    const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
    
    set({ 
      notifications: updatedNotifications, 
      unreadCount 
    });
  },
  
  markAllAsRead: () => {
    const { notifications } = get();
    const updatedNotifications = notifications.map(n => ({ ...n, isRead: true }));
    
    set({ 
      notifications: updatedNotifications, 
      unreadCount: 0 
    });
  },
  
  removeNotification: (id: string) => {
    const { notifications } = get();
    const updatedNotifications = notifications.filter(n => n.id !== id);
    const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
    
    set({ 
      notifications: updatedNotifications, 
      unreadCount 
    });
  },
  
  clearAll: () => {
    set({ 
      notifications: [], 
      unreadCount: 0,
      lastUpdated: new Date()
    });
  },
  
  setLoading: (loading: boolean) => set({ isLoading: loading }),

  setError: (error: string | null) => set({ error }),

  requestRefresh: () => {
    set({ refreshRequestedAt: Date.now() });
  },

  clearRefreshRequested: () => {
    set({ refreshRequestedAt: null });
  },
}));
