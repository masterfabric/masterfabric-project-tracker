/**
 * User messages (snackbar) — fetch + real-time subscription.
 * Shows snackbar when new message arrives.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mfGoUserMessages,
  subscribeUserMessages,
  snackbarService,
} from '@/src/shared/services';
import type { UserMessagePayload } from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';

export function useUserMessages() {
  const authToken = useAppStore((s) => s.authToken);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const [messages, setMessages] = useState<UserMessagePayload[]>([]);
  const [loading, setLoading] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const fetchMessages = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const list = await mfGoUserMessages.list(50);
      setMessages(list);
      list.forEach((m) => seenIdsRef.current.add(m.id));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!isAuthenticated || !authToken) return;
    const unsub = subscribeUserMessages(authToken, (msg) => {
      if (seenIdsRef.current.has(msg.id)) return;
      seenIdsRef.current.add(msg.id);
      setMessages((prev) => [msg, ...prev]);
      const snackType = (msg.type as 'info' | 'success' | 'warning' | 'error') || 'info';
      snackbarService.show({
        message: msg.message,
        type: snackType,
        duration: 5000,
        position: 'bottom',
      });
    });
    return unsub;
  }, [isAuthenticated, authToken]);

  const markRead = useCallback(async (id: string) => {
    try {
      await mfGoUserMessages.markRead(id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, readAt: new Date().toISOString() } : m
        )
      );
    } catch {
      // ignore
    }
  }, []);

  return { messages, loading, fetchMessages, markRead };
}
