/**
 * Real-time user message subscription via graphql-ws.
 * Connects to mf-go WebSocket and subscribes to userMessageCreated.
 */

import { createClient } from 'graphql-ws';
import { getGraphQLUrl } from './environment-service';
import type { UserMessagePayload } from './mf-go-api';
import { USER_MESSAGE_CREATED_SUBSCRIPTION } from './mf-go-api';

function getWsUrl(): string {
  const url = getGraphQLUrl();
  if (url.startsWith('https://')) return url.replace('https://', 'wss://');
  if (url.startsWith('http://')) return url.replace('http://', 'ws://');
  return url;
}

export type UserMessageCallback = (message: UserMessagePayload) => void;

let activeUnsubscribe: (() => void) | null = null;
let activeDispose: (() => void) | null = null;

function cleanupActiveSubscription(reason: string) {
  if (activeUnsubscribe) {
    try {
      activeUnsubscribe();
    } catch {
      // ignore
    }
    activeUnsubscribe = null;
  }

  if (activeDispose) {
    try {
      activeDispose();
    } catch {
      // ignore
    }
    activeDispose = null;
  }

  if (reason) {
    console.info('[UserMessageSubscription] cleaned', { reason });
  }
}

/**
 * Subscribe to real-time user messages. Returns unsubscribe function.
 * Requires accessToken for auth.
 */
export function subscribeUserMessages(
  accessToken: string,
  onMessage: UserMessageCallback
): () => void {
  cleanupActiveSubscription('replace');

  const client = createClient({
    url: getWsUrl(),
    connectionParams: {
      Authorization: `Bearer ${accessToken}`,
    },
    lazy: true,
    retryAttempts: 3,
  });

  const unsub = client.subscribe(
    {
      query: USER_MESSAGE_CREATED_SUBSCRIPTION,
    },
    {
      next: (data) => {
        const payload = data.data?.userMessageCreated as UserMessagePayload | undefined;
        if (payload) onMessage(payload);
      },
      error: (err) => {
        console.warn('[UserMessageSubscription] error', err);
      },
      complete: () => {},
    }
  );

  activeUnsubscribe = unsub;
  activeDispose = () => client.dispose();

  console.info('[UserMessageSubscription] subscribed');

  return () => {
    cleanupActiveSubscription('manual_unsubscribe');
  };
}

export function resetUserMessageSubscriptionClient(): void {
  cleanupActiveSubscription('reset');
}
