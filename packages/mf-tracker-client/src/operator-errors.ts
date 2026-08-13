import { getClientConfig } from "./config";
import { GraphQLError } from "./graphql";

/** Friendly copy when the browser/Electron fetch never reaches mf-go. */
export const UNREACHABLE_API_MESSAGE =
  "Can't reach the MasterFabric API. Start mf-go (GraphQL, usually http://127.0.0.1:8080/graphql), check Settings → GraphQL URL, then retry.";

function isNetworkFailureMessage(message: string): boolean {
  const lower = message.trim().toLowerCase();
  if (!lower) return false;
  return (
    lower === "failed to fetch" ||
    lower === "networkerror when attempting to fetch resource." ||
    lower === "networkerror when attempting to fetch resource" ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("err_connection_refused") ||
    lower.includes("err_name_not_resolved") ||
    lower.includes("internet connection appears to be offline") ||
    lower.startsWith("can't reach the masterfabric api")
  );
}

/** True when `error` looks like a transport / offline failure (not GraphQL). */
export function isUnreachableApiError(error: unknown): boolean {
  if (typeof error === "string") return isNetworkFailureMessage(error);
  if (error instanceof TypeError) return isNetworkFailureMessage(error.message);
  if (error instanceof Error) return isNetworkFailureMessage(error.message);
  return false;
}

/** True when a formatted banner/message is the offline / unreachable API copy. */
export function isUnreachableApiMessage(
  message: string | null | undefined,
): boolean {
  return typeof message === "string" && isNetworkFailureMessage(message);
}

/**
 * Maps known mf-go operator/setup failures to actionable banner copy.
 * Falls back to the raw message for everything else.
 */
export function formatOperatorError(error: unknown, fallback: string): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const codes = error instanceof GraphQLError ? error.codes : ([] as string[]);

  if (isUnreachableApiError(error) || isNetworkFailureMessage(message)) {
    return UNREACHABLE_API_MESSAGE;
  }

  const lower = message.toLowerCase();

  if (
    codes.includes("SESSION_STORE_UNAVAILABLE") ||
    lower.includes("session store unavailable")
  ) {
    return (
      "Session store (Redis) is unavailable. Start Redis for mf-go " +
      "(local often :6380), then sign in again or retry."
    );
  }

  const notLinked =
    codes.includes("CLIENT_APP_ORGANIZATION_NOT_LINKED") ||
    lower.includes("not linked to an organization") ||
    lower.includes("client_app_organization_not_linked");

  if (notLinked) {
    const bundleId = getClientConfig().bundleId || "com.masterfabric.monoExpo";
    return (
      "This client app is not linked to an organization. In MasterFabric Core → Apps, " +
      `open the app that matches bundle ID (${bundleId}) ` +
      "and set its Organization to your tenant (e.g. Demo), then retry. " +
      "Local seed also re-links this bundle to the Demo org on mf-go restart."
    );
  }

  const mismatch =
    codes.includes("CLIENT_APP_ORGANIZATION_MISMATCH") ||
    lower.includes("client_app_organization_mismatch") ||
    (lower.includes("organization") && lower.includes("mismatch"));

  if (mismatch) {
    return (
      "This client app is linked to a different organization than the one selected. " +
      "In MasterFabric Core → Apps, align the app's Organization with the workspace tenant, " +
      "or switch to the linked org in the sidebar."
    );
  }

  const tenantCannotCreate =
    codes.includes("TENANT_APP_CANNOT_CREATE_ORGANIZATION") ||
    lower.includes("cannot create additional organizations") ||
    lower.includes("tenant_app_cannot_create_organization");

  if (tenantCannotCreate) {
    return (
      "This client app is linked to a tenant organization, so members join that org " +
      "and cannot create additional organizations. Use the organization already in the " +
      "sidebar (or ask an admin to unlink the app in MasterFabric Core → Apps)."
    );
  }

  return message.trim() || fallback;
}

/** True when GraphQL validation failed for dueAt / subtasks on older mf-go schemas. */
export function isPersonalTodoSchemaMismatchError(error: unknown): boolean {
  if (!(error instanceof GraphQLError)) {
    const msg = error instanceof Error ? error.message : String(error ?? "");
    return /HTTP 422/i.test(msg) && /dueat|subtask/i.test(msg);
  }
  const codes = error.codes;
  const msg = error.message.toLowerCase();
  const validation =
    codes.includes("GRAPHQL_VALIDATION_FAILED") ||
    /cannot query field|unknown field|unknown argument|unknown type|http 422/i.test(
      msg,
    );
  if (!validation) return false;
  return /dueat|due_at|cleardueat|subtasks|usertodosubtask|createusertodosubtask|updateusertodosubtask|deleteusertodosubtask/.test(
    msg,
  );
}
