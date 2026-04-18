/**
 * Real-time organization channel messages via graphql-ws.
 */

import { createClient } from 'graphql-ws';
import { getGraphQLUrl } from './environment-service';
import type { OrganizationMessagePayload } from './mf-go-api';
import { ORGANIZATION_MESSAGE_CREATED_SUBSCRIPTION } from './mf-go-api';

function getWsUrl(): string {
  const url = getGraphQLUrl();
  if (url.startsWith('https://')) return url.replace('https://', 'wss://');
  if (url.startsWith('http://')) return url.replace('http://', 'ws://');
  return url;
}

export type OrganizationMessageCallback = (message: OrganizationMessagePayload) => void;

/**
 * Subscribe to new messages for one organization. Returns unsubscribe that disposes the WS client.
 */
export function subscribeOrganizationMessages(
  accessToken: string,
  organizationId: string,
  onMessage: OrganizationMessageCallback
): () => void {
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
      query: ORGANIZATION_MESSAGE_CREATED_SUBSCRIPTION,
      variables: { organizationId },
    },
    {
      next: (data) => {
        const payload = data.data?.organizationMessageCreated as
          | OrganizationMessagePayload
          | undefined;
        if (payload) onMessage(payload);
      },
      error: (err) => {
        console.warn('[OrgMessageSubscription] error', err);
      },
      complete: () => {},
    }
  );

  return () => {
    try {
      unsub();
    } catch {
      // ignore
    }
    try {
      client.dispose();
    } catch {
      // ignore
    }
  };
}
