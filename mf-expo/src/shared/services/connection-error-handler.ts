/**
 * Connection Error Handler
 *
 * Handles server/network connection errors and shows Snackbar notifications.
 * Uses debouncing: shows snackbar on first error, then again only after 1.5s
 * if errors continue (avoids spam while allowing repeat notification).
 */

import { t } from '@/src/shared/i18n';
import { isLoopbackGraphQLUrlOnPhysicalDevice } from './environment-service';
import { logger } from './logger';
import { snackbarService } from './snackbar-service';

const DEBOUNCE_MS = 1500; // 1.5s — wait before showing again
const SNACKBAR_DURATION = 4500;

/** Network/connection error patterns (fetch, React Native, Node) */
const CONNECTION_ERROR_PATTERNS = [
  'fetch failed',
  'network request failed',
  'networkerror',
  'network error',
  'econnrefused',
  'etimedout',
  'econnreset',
  'enotfound',
  'err_connection_refused',
  'err_connection_reset',
  'err_connection_timed_out',
  'err_network',
  'failed to fetch',
  'load failed',
  'connection refused',
  'connection reset',
  'connection timed out',
  'no internet',
  'offline',
];

let lastShownAt = 0;

/**
 * Check if error is a connection/network error (not auth, not validation).
 */
export function isConnectionError(error: unknown): boolean {
  if (!error) return false;

  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // Auth errors should not trigger connection snackbar
  if (lower.includes('unauthorized') || lower.includes('unauthenticated')) {
    return false;
  }

  return CONNECTION_ERROR_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Show connection lost snackbar with debouncing.
 * First error: show immediately. Subsequent errors within DEBOUNCE_MS: skip.
 * After DEBOUNCE_MS: show again if error persists.
 */
export function handleConnectionError(error: unknown): void {
  if (!isConnectionError(error)) return;

  const now = Date.now();
  if (now - lastShownAt < DEBOUNCE_MS) {
    logger.debug('[ConnectionError] Debounced snackbar (too soon)');
    return;
  }

  lastShownAt = now;
  const message = isLoopbackGraphQLUrlOnPhysicalDevice()
    ? t('errors.localBackendLoopbackOnDevice')
    : t('errors.connectionLost');

  snackbarService.show({
    message,
    type: 'error',
    duration: SNACKBAR_DURATION,
    action: {
      label: t('errors.tryAgain'),
      onPress: () => {
        // Snackbar dismisses when the user taps Retry
        // The component that owns the action performs the actual retry
      },
    },
  });

  logger.warn('[ConnectionError] Connection lost, snackbar shown', { error });
}
