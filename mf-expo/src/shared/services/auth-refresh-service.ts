/**
 * Auth refresh service — attempts token refresh on 401, app launch, every 3 min.
 * Updates session and user (email, role, etc.) from refresh payload.
 * Passes device info for session tracking (admin can see active sessions).
 *
 * All refresh entrypoints share a single in-flight promise so overlapping calls
 * (foreground + interval + GraphQL auth handler) do not rotate the same refresh
 * token twice and force a bogus logout.
 */

import { Platform } from 'react-native';
import { t } from '@/src/shared/i18n';
import { useAppStore } from '../store';
import { getOrCreateDeviceId } from './device-registration-service';
import { mfGoAuth, syncMfGoAuthToken } from './mf-go-api';
import type { AuthPayload } from './mf-go-api';
import {
  extractGraphQLExtensionsCodes,
  isDefinitiveRefreshSessionError,
  isTransientGraphQLOrNetworkError,
} from './graphql-client';
import { logger } from './logger';
import { snackbarService } from './snackbar-service';

const REFRESH_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
/** Bounded retries for network / 5xx / 429 / infra GraphQL codes before logout (GFG-76). */
const MAX_REFRESH_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let refreshInFlight: Promise<AuthPayload | null> | null = null;

/** Get device info for session tracking (admin visibility) */
async function getDeviceInfoForRefresh(): Promise<{
  deviceId: string;
  platform: string;
  deviceName: string;
}> {
  const deviceId = await getOrCreateDeviceId();
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const deviceName = Platform.OS === 'web' ? 'Web' : `${Platform.OS} device`;
  return { deviceId, platform, deviceName };
}

/** Check if error is schema validation (backend doesn't support device fields yet) */
function isSchemaValidationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('unknown field') &&
    (msg.includes('deviceID') || msg.includes('deviceName') || msg.includes('platform'))
  );
}

/**
 * GraphQL often returns HTTP 200 with errors, so `isTransientGraphQLOrNetworkError` misses 5xx.
 * Redis/Azure blips on refresh map to INTERNAL_ERROR (wrapped Go errors) or SESSION_STORE_UNAVAILABLE.
 */
function isRefreshInfrastructureRetryableError(err: unknown): boolean {
  const codes = extractGraphQLExtensionsCodes(err);
  if (codes.includes('INTERNAL_ERROR')) return true;
  if (codes.includes('SESSION_STORE_UNAVAILABLE')) return true;
  return false;
}

/** Single refresh attempt including device-field schema fallback. */
async function refreshTokensOnce(userId: string, refreshToken: string): Promise<AuthPayload> {
  try {
    const deviceInfo = await getDeviceInfoForRefresh();
    return await mfGoAuth.refreshTokens(userId, refreshToken, deviceInfo);
  } catch (err) {
    if (isSchemaValidationError(err)) {
      logger.debug('[AuthRefresh] Backend lacks device fields, retrying without');
      return await mfGoAuth.refreshTokens(userId, refreshToken);
    }
    throw err;
  }
}

async function executeAuthRefresh(): Promise<AuthPayload | null> {
  const { mfGoSession, setMfGoAuth, logout } = useAppStore.getState();

  if (!mfGoSession?.refreshToken) {
    logger.warn('[AuthRefresh] No session or refresh token, logging out');
    logout();
    syncMfGoAuthToken(null);
    return null;
  }

  const { userId, refreshToken } = mfGoSession;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_REFRESH_ATTEMPTS; attempt++) {
    try {
      const payload = await refreshTokensOnce(userId, refreshToken);

      setMfGoAuth({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
      });
      syncMfGoAuthToken(payload.accessToken);
      logger.info('[AuthRefresh] Tokens refreshed', {
        userId: payload.user.id,
        email: payload.user.email,
      });
      return payload;
    } catch (err) {
      lastError = err;
      if (isDefinitiveRefreshSessionError(err)) {
        break;
      }
      const retryable =
        attempt < MAX_REFRESH_ATTEMPTS - 1 &&
        (isTransientGraphQLOrNetworkError(err) || isRefreshInfrastructureRetryableError(err));
      if (retryable) {
        const delayMs = 400 * (attempt + 1) + Math.floor(Math.random() * 250);
        logger.warn('[AuthRefresh] Transient or infra failure, will retry', {
          attempt: attempt + 1,
          max: MAX_REFRESH_ATTEMPTS,
          delayMs,
          codes: extractGraphQLExtensionsCodes(err),
        });
        await sleep(delayMs);
        continue;
      }
      break;
    }
  }

  logger.warn('[AuthRefresh] Refresh failed, logging out', { error: lastError });
  snackbarService.show({
    message: t('errors.sessionExpired'),
    type: 'error',
    duration: 5000,
  });
  logout();
  syncMfGoAuthToken(null);
  return null;
}

/**
 * Runs at most one refresh at a time; concurrent callers await the same result.
 * Returns the auth payload on success (store already updated), or null after logout.
 */
export async function refreshAuthTokensSingleFlight(): Promise<AuthPayload | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  refreshInFlight = (async () => {
    try {
      return await executeAuthRefresh();
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Attempts to refresh tokens using stored session.
 * On success: updates store with fresh tokens + user (email, role, etc.), syncs GraphQL client.
 * On failure: logs out and clears session.
 * @returns true if refresh succeeded, false otherwise
 */
export async function attemptAuthRefresh(): Promise<boolean> {
  const payload = await refreshAuthTokensSingleFlight();
  return payload != null;
}

/** Refresh interval in ms (3 min). Export for use in hooks. */
export const AUTH_REFRESH_INTERVAL_MS = REFRESH_INTERVAL_MS;
