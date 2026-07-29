import { storage } from "./storage";
import type { AuthUser } from "./types";

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:8080/graphql";
const API_KEY = process.env.NEXT_PUBLIC_MF_API_KEY?.trim() ?? "";
const BUNDLE_ID =
  process.env.NEXT_PUBLIC_MF_BUNDLE_ID?.trim() || "com.masterfabric.monoExpo";

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_KEY) headers["X-API-Key"] = API_KEY;
  if (BUNDLE_ID) headers["X-Bundle-ID"] = BUNDLE_ID;
  return headers;
}

function isAuthFailure(err: GraphQLError): boolean {
  const codes = err.codes;
  if (
    codes.includes("UNAUTHORIZED") ||
    codes.includes("UNAUTHENTICATED") ||
    codes.includes("AUTHENTICATION_REQUIRED")
  ) {
    return true;
  }
  const msg = err.message.toLowerCase();
  return (
    msg.includes("authentication required") ||
    msg.includes("unauthorized") ||
    msg.includes("unauthenticated") ||
    msg.includes("access denied") && msg.includes("token")
  );
}

async function postGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<{ data?: T; errors?: GraphQLErrorItem[] }> {
  const headers = identityHeaders();
  if (!options?.skipAuth) {
    const token = options?.token ?? storage.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
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
        platform: "web",
        deviceName: "mf-web",
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
      try {
        return await refreshSessionOnce();
      } catch (err) {
        const authLike =
          err instanceof GraphQLError &&
          (isAuthFailure(err) ||
            err.codes.includes("INVALID_REFRESH_TOKEN") ||
            err.codes.includes("REFRESH_TOKEN_INVALID") ||
            /refresh|session|unauthorized|unauthenticated/i.test(err.message));
        if (authLike) {
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

export function graphqlUrl() {
  return GRAPHQL_URL;
}
