import { GraphQLClient } from 'graphql-request';
import { getGraphQLUrl } from './environment-service';
import { handleConnectionError, isConnectionError } from './connection-error-handler';
import { logger } from './logger';

/** Called when server returns UNAUTHORIZED/UNAUTHENTICATED (e.g. expired token). May be async. */
let onAuthError: (() => void | Promise<void>) | null = null;

/** Register handler for auth errors. Call from app init (e.g. useMfGoAuthSync). */
export function setGraphQLAuthErrorHandler(handler: (() => void | Promise<void>) | null): void {
  onAuthError = handler;
}

/** GraphQL client for mf-go backend (Auth, User, Settings, Admin) */
let graphqlClient: GraphQLClient | null = null;

/** Reset client so next request uses new URL (e.g. after env switch) */
export function resetGraphQLClient(): void {
  graphqlClient = null;
}

function getGraphQLClient(): GraphQLClient {
  if (!graphqlClient) {
    const url = getGraphQLUrl();
    graphqlClient = new GraphQLClient(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    logger.debug('GraphQL client initialized', { url });
  }
  return graphqlClient;
}

function isAuthError(error: unknown): boolean {
  if (extractGraphQLExtensionsCodes(error).includes('ACCOUNT_DISABLED')) {
    return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('UNAUTHORIZED') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('ACCOUNT_DISABLED')
  );
}

/** Schema validation errors (old backend) — avoid logging as ERROR. */
function isSchemaValidationError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('unknown field') ||
    msg.includes('Cannot query field') ||
    msg.includes('GRAPHQL_VALIDATION_FAILED')
  );
}

/** Expected domain errors (rate limits, OTP mismatch, etc.) — not transport/server bugs; avoid ERROR logs. */
function isBenignGraphQLClientError(error: unknown): boolean {
  const codes = extractGraphQLExtensionsCodes(error);
  // Login / register — wrong password, taken email, etc. UI shows friendly copy; not a client bug.
  if (codes.includes('INVALID_CREDENTIALS')) return true;
  if (codes.includes('EMAIL_TAKEN')) return true;
  if (codes.includes('LOGIN_RATE_LIMITED')) return true;
  if (codes.includes('PASSWORD_REUSE_NOT_ALLOWED')) return true;
  if (codes.includes('ACCOUNT_DISABLED')) return true;
  if (codes.includes('OTP_RATE_LIMITED')) return true;
  // OTP verify outcomes — graphql-request still throws; UI shows getGraphQLErrorMessage; no need for console.error.
  if (codes.includes('OTP_NOT_FOUND')) return true;
  if (codes.includes('OTP_EXPIRED')) return true;
  if (codes.includes('OTP_INVALID')) return true;
  if (codes.includes('OTP_MAX_ATTEMPTS')) return true;
  // mf-go refuses login/register/OTP verify without Redis; handled in UI via getAuthErrorMessage.
  if (codes.includes('SESSION_STORE_UNAVAILABLE')) return true;
  if (codes.includes('OTP_UNAVAILABLE')) return true;
  return false;
}

export function extractGraphQLExtensionsCodes(error: unknown): string[] {
  if (error === null || typeof error !== 'object') return [];
  const response = (error as { response?: { errors?: Array<{ extensions?: { code?: string } }> } })
    .response;
  const errors = response?.errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .map((e) => (typeof e?.extensions?.code === 'string' ? e.extensions.code : ''))
    .filter(Boolean);
}

/** Definitive refresh failures — do not retry; session is invalid or disabled. */
export function isDefinitiveRefreshSessionError(error: unknown): boolean {
  const codes = extractGraphQLExtensionsCodes(error);
  if (codes.includes('TOKEN_INVALID')) return true;
  if (codes.includes('ACCOUNT_DISABLED')) return true;
  if (codes.includes('USER_NOT_FOUND')) return true;
  const msg = error instanceof Error ? error.message : String(error);
  if (/token is invalid|TOKEN_INVALID/i.test(msg)) return true;
  return false;
}

/** Transient transport / overload — refresh may succeed on retry (GFG-76). */
export function isTransientGraphQLOrNetworkError(error: unknown): boolean {
  if (isConnectionError(error)) return true;
  const st = (error as { response?: { status?: number } })?.response?.status;
  if (typeof st === 'number') {
    if (st >= 500) return true;
    if (st === 429 || st === 408) return true;
  }
  return false;
}

/** Set Bearer token for authenticated requests */
export function setGraphQLAuthToken(token: string): void {
  const client = getGraphQLClient();
  client.setHeader('Authorization', `Bearer ${token}`);
}

/** Remove auth token */
export function clearGraphQLAuthToken(): void {
  const client = getGraphQLClient();
  client.setHeader('Authorization', '');
}

/** Execute a GraphQL request. Use silent: true when retrying after a known schema mismatch (e.g. nickname) to avoid logging. */
export async function graphqlRequest<T, V extends Record<string, unknown> = Record<string, unknown>>(
  document: string,
  variables?: V,
  options?: { silent?: boolean; skipAuthRecovery?: boolean }
): Promise<T> {
  const client = getGraphQLClient();
  try {
    return await client.request<T>(document, variables);
  } catch (error) {
    if (isAuthError(error)) {
      clearGraphQLAuthToken();
      if (!options?.skipAuthRecovery) {
        await onAuthError?.();
        // Retry original request once after refresh so callers do not need manual re-try
        // when access token expired mid-request.
        return await client.request<T>(document, variables);
      }
      // Don't log auth errors — we handle them (refresh or logout). Avoids noise when
      // multiple in-flight requests fail after token expiry.
    } else if (isConnectionError(error)) {
      handleConnectionError(error);
    }
    const logGraphQLFailure =
      !options?.silent &&
      !isAuthError(error) &&
      !isSchemaValidationError(error) &&
      !isBenignGraphQLClientError(error);
    if (logGraphQLFailure) {
      logger.error('GraphQL request failed', { url: getGraphQLUrl(), error });
    }
    throw error;
  }
}

export { getGraphQLClient };
