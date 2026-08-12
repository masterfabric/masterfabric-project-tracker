import { getClientConfig, getSessionStorage } from "./config";
import type { AuthUser } from "./types";

type GraphQLErrorItem = {
  message: string;
  extensions?: { code?: string };
};

export class GraphQLError extends Error {
  constructor(
    message: string,
    public readonly errors?: GraphQLErrorItem[],
  ) {
    super(message);
    this.name = "GraphQLError";
  }

  get codes(): string[] {
    return (this.errors ?? [])
      .map((e) => e.extensions?.code)
      .filter((c): c is string => Boolean(c));
  }
}

type RequestOptions = {
  token?: string | null;
  skipAuth?: boolean;
  skipAuthRecovery?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;
let onSessionInvalid: (() => void) | null = null;

/** Called when refresh fails and the session must be cleared (e.g. logout UI). */
export function setSessionInvalidHandler(handler: (() => void) | null) {
  onSessionInvalid = handler;
}

function identityHeaders(): Record<string, string> {
  const { apiKey, bundleId } = getClientConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["X-API-Key"] = apiKey;
  if (bundleId) headers["X-Bundle-ID"] = bundleId;
  return headers;
}

/** Redis/session-store outages must not wipe a still-valid local session. */
function isTransientSessionStoreFailure(err: GraphQLError): boolean {
  if (err.codes.includes("SESSION_STORE_UNAVAILABLE")) return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("session store unavailable") ||
    (msg.includes("redis") && msg.includes("unavailable"))
  );
}

function isAuthFailure(err: GraphQLError): boolean {
  if (isTransientSessionStoreFailure(err)) return false;
  const codes = err.codes;
  if (
    codes.includes("UNAUTHORIZED") ||
    codes.includes("UNAUTHENTICATED") ||
    codes.includes("AUTHENTICATION_REQUIRED") ||
    codes.includes("TOKEN_INVALID") ||
    codes.includes("TOKEN_EXPIRED") ||
    codes.includes("INVALID_REFRESH_TOKEN") ||
    codes.includes("REFRESH_TOKEN_INVALID")
  ) {
    return true;
  }
  const msg = err.message.toLowerCase();
  return (
    msg.includes("authentication required") ||
    msg.includes("unauthorized") ||
    msg.includes("unauthenticated") ||
    msg.includes("token is invalid") ||
    msg.includes("token is expired") ||
    (msg.includes("access denied") && msg.includes("token"))
  );
}

/** True when refresh failed because the refresh token itself is dead. */
function isInvalidRefreshFailure(err: GraphQLError): boolean {
  if (isTransientSessionStoreFailure(err)) return false;
  const codes = err.codes;
  if (
    codes.includes("TOKEN_INVALID") ||
    codes.includes("TOKEN_EXPIRED") ||
    codes.includes("INVALID_REFRESH_TOKEN") ||
    codes.includes("REFRESH_TOKEN_INVALID") ||
    codes.includes("UNAUTHORIZED") ||
    codes.includes("UNAUTHENTICATED") ||
    codes.includes("AUTHENTICATION_REQUIRED")
  ) {
    return true;
  }
  const msg = err.message.toLowerCase();
  // Avoid matching "session store unavailable" — that is infrastructure, not logout.
  return (
    msg.includes("token is invalid") ||
    msg.includes("token is expired") ||
    msg.includes("invalid refresh") ||
    (msg.includes("refresh token") &&
      (msg.includes("invalid") || msg.includes("expired")))
  );
}

async function postGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<{ data?: T; errors?: GraphQLErrorItem[] }> {
  const storage = getSessionStorage();
  const { graphqlUrl } = getClientConfig();
  const headers = identityHeaders();
  if (!options?.skipAuth) {
    const token = options?.token ?? storage.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  }).catch((err: unknown) => {
    // Preserve TypeError "Failed to fetch" etc. for formatOperatorError mapping.
    throw err instanceof Error ? err : new TypeError("Failed to fetch");
  });

  const json = (await res.json().catch(() => null)) as {
    data?: T;
    errors?: GraphQLErrorItem[];
  } | null;

  // gqlgen often returns 422 with a GraphQL body for validation failures —
  // surface those as GraphQLError so callers can fall back to older schemas.
  if (json?.errors?.length) {
    return json;
  }

  if (!res.ok) {
    throw new GraphQLError(
      `HTTP ${res.status}: ${res.statusText}${
        json ? ` · ${JSON.stringify(json).slice(0, 200)}` : ""
      }`,
    );
  }

  return json ?? {};
}

async function refreshSessionOnce(): Promise<boolean> {
  const storage = getSessionStorage();
  const { platform, deviceName } = getClientConfig();
  const refreshToken = storage.getRefreshToken();
  const rawUser = storage.getUserJson();
  if (!refreshToken || !rawUser) return false;

  let user: AuthUser;
  try {
    user = JSON.parse(rawUser) as AuthUser;
  } catch {
    return false;
  }
  if (!user.id) return false;

  const json = await postGraphQL<{
    refreshTokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: AuthUser;
    };
  }>(
    `mutation RefreshTokens($input: RefreshInput!) {
      refreshTokens(input: $input) {
        accessToken refreshToken expiresIn
        user { id email displayName avatarURL role }
      }
    }`,
    {
      input: {
        userID: user.id,
        refreshToken,
        platform,
        deviceName,
      },
    },
    { skipAuth: true, skipAuthRecovery: true },
  );

  if (json.errors?.length) {
    throw new GraphQLError(
      json.errors.map((e) => e.message).join("; "),
      json.errors,
    );
  }

  const session = json.data?.refreshTokens;
  if (!session?.accessToken || !session.refreshToken) return false;

  storage.setSession(
    session.accessToken,
    session.refreshToken,
    JSON.stringify(session.user),
  );
  return true;
}

/** Single-flight refresh shared by GraphQL recovery and proactive timers. */
export async function ensureFreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const storage = getSessionStorage();
      try {
        return await refreshSessionOnce();
      } catch (err) {
        // Network / Redis blips: keep local tokens so Retry can recover.
        if (!(err instanceof GraphQLError)) return false;
        if (isTransientSessionStoreFailure(err)) return false;
        if (isInvalidRefreshFailure(err)) {
          storage.clearSession();
          onSessionInvalid?.();
        }
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> {
  const json = await postGraphQL<T>(query, variables, options);

  if (json.errors?.length) {
    const err = new GraphQLError(
      json.errors.map((e) => e.message).join("; "),
      json.errors,
    );

    if (!options?.skipAuth && !options?.skipAuthRecovery && isAuthFailure(err)) {
      const refreshed = await ensureFreshSession();
      if (refreshed) {
        return graphqlRequest<T>(query, variables, {
          ...options,
          skipAuthRecovery: true,
        });
      }
    }

    throw err;
  }

  if (json.data === undefined) {
    throw new GraphQLError("Empty GraphQL response");
  }

  return json.data;
}
