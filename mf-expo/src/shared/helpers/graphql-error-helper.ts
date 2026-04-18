/**
 * GraphQL error helper — maps mf-go `extensions.code` and connection failures to i18n.
 * Use `getGraphQLErrorMessage` for non-auth UI; `getAuthErrorMessage` is an alias for
 * login/register/OTP flows (same mapping, friendly copy — no raw ClientError JSON).
 */

import type { GraphQLError } from 'graphql';
import { ClientError } from 'graphql-request';
import { t } from '@/src/shared/i18n';
import { isConnectionError } from '../services/connection-error-handler';
import { isLoopbackGraphQLUrlOnPhysicalDevice } from '../services/environment-service';
import { isDueAtSchemaMismatchError } from '../services/graphql-due-at-fallback';

/** Auth / OTP codes (mf-go `internal/shared/errors` + OTP delivery). */
const AUTH_ERROR_CODES: Record<string, string> = {
  INVALID_CREDENTIALS: 'errors.auth.invalidCredentials',
  EMAIL_TAKEN: 'errors.auth.emailTaken',
  ACCOUNT_DISABLED: 'errors.auth.accountDisabled',
  TOKEN_EXPIRED: 'errors.sessionExpired',
  TOKEN_INVALID: 'errors.sessionExpired',
  SESSION_STORE_UNAVAILABLE: 'errors.auth.sessionStoreUnavailable',
  OTP_UNAVAILABLE: 'errors.auth.sessionStoreUnavailable',
  OTP_RATE_LIMITED: 'errors.otp.rateLimited',
  OTP_EMAIL_FAILED: 'errors.otp.emailFailed',
  OTP_EMAIL_DISABLED: 'errors.otp.emailDisabled',
  OTP_NO_EMAIL: 'errors.otp.noEmail',
  OTP_NO_PHONE: 'errors.otp.noPhone',
  OTP_NO_TELEGRAM: 'errors.otp.noTelegram',
  OTP_NOT_FOUND: 'errors.otp.notFound',
  OTP_EXPIRED: 'errors.otp.expired',
  OTP_INVALID: 'errors.otp.invalid',
  OTP_MAX_ATTEMPTS: 'errors.otp.maxAttempts',
};

/** Other domain codes from mf-go GraphQL. */
const DOMAIN_ERROR_CODES: Record<string, string> = {
  USER_NOT_FOUND: 'errors.graphql.userNotFound',
  UNAUTHORIZED: 'errors.graphql.unauthorized',
  FORBIDDEN: 'errors.graphql.forbidden',
  LOGIN_RATE_LIMITED: 'errors.graphql.loginRateLimited',
  PASSWORD_REUSE_NOT_ALLOWED: 'errors.graphql.passwordReuseNotAllowed',
  SETTINGS_NOT_FOUND: 'errors.graphql.settingsNotFound',
  NOTIFICATION_NOT_FOUND: 'errors.graphql.notificationNotFound',
  ADDRESS_NOT_FOUND: 'errors.graphql.addressNotFound',
  TODO_NOT_FOUND: 'errors.graphql.todoNotFound',
  SCHEMA_OUT_OF_DATE: 'errors.graphql.schemaOutOfDate',
  DATABASE_ERROR: 'errors.graphql.databaseError',
  INTERNAL_ERROR: 'errors.graphql.internal',
  PRODUCT_RELEASE_VERSION_REQUIRED: 'errors.graphql.productReleaseVersionRequired',
  FEEDBACK_THREAD_NOT_FOUND: 'errors.graphql.feedbackThreadNotFound',
  FEEDBACK_MESSAGE_EMPTY: 'errors.graphql.feedbackMessageEmpty',
  FEEDBACK_GUEST_EMAIL_REQUIRED: 'errors.graphql.feedbackGuestEmailRequired',
  FEEDBACK_GUEST_EMAIL_INVALID: 'errors.graphql.feedbackGuestEmailInvalid',
};

const GRAPHQL_ERROR_CODE_TO_I18N: Record<string, string> = {
  ...AUTH_ERROR_CODES,
  ...DOMAIN_ERROR_CODES,
};

function isClientError(error: unknown): error is ClientError {
  return error instanceof ClientError && 'response' in error;
}

function getErrorCode(error: GraphQLError): string | null {
  const ext = error.extensions as Record<string, unknown> | undefined;
  return (ext?.code as string) ?? null;
}

/** Heuristics when `extensions.code` is missing (older backends). */
function inferAuthErrorFromMessage(msg: string): string | null {
  const lower = msg.toLowerCase();
  if (
    lower.includes('invalid') &&
    (lower.includes('password') || lower.includes('credential') || lower.includes('email'))
  ) {
    return 'errors.auth.invalidCredentials';
  }
  if (
    lower.includes('email') &&
    (lower.includes('taken') || lower.includes('already') || lower.includes('registered'))
  ) {
    return 'errors.auth.emailTaken';
  }
  if (lower.includes('inactive') || lower.includes('suspended') || lower.includes('disabled')) {
    return 'errors.auth.accountDisabled';
  }
  return null;
}

/** mf-go `validation.Struct` → GraphQL `VALIDATION_ERROR` (e.g. `Password: failed on 'min'`). */
function inferValidationErrorI18nKey(msg: string): string | null {
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes('password') && (lower.includes("failed on 'min'") || lower.includes('min'))) {
    return 'auth.forgotPassword.passwordTooShort';
  }
  if (
    (lower.includes('displayname') || lower.includes('display name')) &&
    (lower.includes("failed on 'min'") || lower.includes('min'))
  ) {
    return 'validation.nameMinLength';
  }
  if (lower.includes('email') && (lower.includes('invalid') || lower.includes("failed on 'email'"))) {
    return 'validation.emailInvalid';
  }
  return null;
}

function inferDomainFromMessage(msg: string): string | null {
  const lower = msg.toLowerCase();
  if (lower.includes('not found')) return 'errors.graphql.notFound';
  if (lower.includes('forbidden') || lower.includes('access denied')) return 'errors.graphql.forbidden';
  if (
    lower.includes('unauthorized') ||
    (lower.includes('authentication') && lower.includes('required'))
  ) {
    return 'errors.graphql.unauthorized';
  }
  if (lower.includes('internal') && lower.includes('error')) return 'errors.graphql.internal';
  return null;
}

/** Strip graphql-request's appended JSON from `Error.message` for logging/guards. */
function stripClientErrorJsonMessage(msg: string): string {
  const jsonStart = msg.indexOf(': {');
  if (jsonStart > 0) return msg.slice(0, jsonStart).trim();
  return msg;
}

/**
 * User-facing message for any GraphQL `ClientError` / network failure from mf-go.
 * Prefer this over `error.message` in catch blocks so users never see raw GraphQL payloads.
 */
export function getGraphQLErrorMessage(error: unknown): string {
  if (!error) return t('errors.unknown');

  if (isConnectionError(error)) {
    return isLoopbackGraphQLUrlOnPhysicalDevice()
      ? t('errors.localBackendLoopbackOnDevice')
      : t('errors.connectionLost');
  }

  if (isClientError(error)) {
    if (isDueAtSchemaMismatchError(error)) {
      return t('errors.graphql.dueAtSchemaNotSupported');
    }
    const errors = error.response?.errors;
    const first = Array.isArray(errors) ? errors[0] : null;
    if (first) {
      const code = getErrorCode(first);
      const msg = typeof first.message === 'string' ? first.message : '';
      if (code === 'VALIDATION_ERROR' && msg) {
        const vKey = inferValidationErrorI18nKey(msg);
        if (vKey) return t(vKey);
      }
      const i18nKey = code ? GRAPHQL_ERROR_CODE_TO_I18N[code] : null;
      if (i18nKey) {
        return t(i18nKey);
      }
      const inferredAuth = msg ? inferAuthErrorFromMessage(msg) : null;
      if (inferredAuth) return t(inferredAuth);
      const inferredDomain = msg ? inferDomainFromMessage(msg) : null;
      if (inferredDomain) return t(inferredDomain);
    }
  }

  if (error instanceof Error) {
    const raw = stripClientErrorJsonMessage(error.message);
    if (raw.length > 0 && raw.length < 200) {
      const inferredAuth = inferAuthErrorFromMessage(raw);
      if (inferredAuth) return t(inferredAuth);
      const inferredDomain = inferDomainFromMessage(raw);
      if (inferredDomain) return t(inferredDomain);
    }
  }

  return t('errors.unknown');
}

/**
 * Resolved i18n **key** for the first matching GraphQL / network layer (no `t()`).
 * Use to branch UI (e.g. snackbar only for `errors.auth.invalidCredentials`) without comparing translated strings.
 * Returns `null` when nothing in the graph matches (caller may fall back to `errors.unknown` via {@link getGraphQLErrorMessage}).
 */
export function getGraphQLErrorI18nKey(error: unknown): string | null {
  if (!error) return null;

  if (isConnectionError(error)) {
    return isLoopbackGraphQLUrlOnPhysicalDevice()
      ? 'errors.localBackendLoopbackOnDevice'
      : 'errors.connectionLost';
  }

  if (isClientError(error)) {
    if (isDueAtSchemaMismatchError(error)) {
      return 'errors.graphql.dueAtSchemaNotSupported';
    }
    const errors = error.response?.errors;
    const first = Array.isArray(errors) ? errors[0] : null;
    if (first) {
      const code = getErrorCode(first);
      const msg = typeof first.message === 'string' ? first.message : '';
      if (code === 'VALIDATION_ERROR' && msg) {
        const vKey = inferValidationErrorI18nKey(msg);
        if (vKey) return vKey;
      }
      const i18nKey = code ? GRAPHQL_ERROR_CODE_TO_I18N[code] : null;
      if (i18nKey) return i18nKey;
      if (msg) {
        const inferredAuth = inferAuthErrorFromMessage(msg);
        if (inferredAuth) return inferredAuth;
        const inferredDomain = inferDomainFromMessage(msg);
        if (inferredDomain) return inferredDomain;
      }
    }
  }

  if (error instanceof Error) {
    const raw = stripClientErrorJsonMessage(error.message);
    if (raw.length > 0 && raw.length < 200) {
      const inferredAuth = inferAuthErrorFromMessage(raw);
      if (inferredAuth) return inferredAuth;
      const inferredDomain = inferDomainFromMessage(raw);
      if (inferredDomain) return inferredDomain;
    }
  }

  return null;
}

/** Same mapping as `getGraphQLErrorMessage` — kept for auth call sites. */
export function getAuthErrorMessage(error: unknown): string {
  return getGraphQLErrorMessage(error);
}
