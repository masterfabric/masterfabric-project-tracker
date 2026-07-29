import { GraphQLError } from "./graphql";

/**
 * Maps known mf-go operator/setup failures to actionable banner copy.
 * Falls back to the raw message for everything else.
 */
export function formatOperatorError(error: unknown, fallback: string): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const codes =
    error instanceof GraphQLError
      ? error.codes
      : ([] as string[]);

  const lower = message.toLowerCase();
  const notLinked =
    codes.includes("CLIENT_APP_ORGANIZATION_NOT_LINKED") ||
    lower.includes("not linked to an organization") ||
    lower.includes("client_app_organization_not_linked");

  if (notLinked) {
    return (
      "This client app is not linked to an organization. In MasterFabric Core → Apps, " +
      "open the app that matches NEXT_PUBLIC_MF_BUNDLE_ID (com.masterfabric.monoExpo) " +
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
