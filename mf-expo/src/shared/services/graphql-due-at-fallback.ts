/**
 * Detects GraphQL failures caused by older mf-go/schema (no dueAt on todos).
 * Used to retry mutations without due fields so saves still succeed.
 */

import { ClientError } from 'graphql-request';

function isClientError(error: unknown): error is ClientError {
  return error instanceof ClientError && 'response' in error;
}

/** True when the server rejected the operation because due date/time fields are unknown to its schema. */
export function isDueAtSchemaMismatchError(error: unknown): boolean {
  if (!isClientError(error)) return false;
  const first = error.response?.errors?.[0];
  if (!first) return false;
  const code = (first.extensions as { code?: string } | undefined)?.code;
  const msg = typeof first.message === 'string' ? first.message : '';
  const lower = msg.toLowerCase();
  if (code === 'GRAPHQL_VALIDATION_FAILED') {
    return (
      /dueat|due_at/.test(lower) ||
      (/unknown field|unknown argument|cannot query field|variable/i.test(lower) &&
        /todo|organizationproject/i.test(lower))
    );
  }
  return false;
}

/** True when the server schema has no todo subtasks fields (mf-go before migration 024 / GFG-117). */
export function isSubtasksSchemaMismatchError(error: unknown): boolean {
  if (!isClientError(error)) return false;
  const first = error.response?.errors?.[0];
  if (!first) return false;
  const code = (first.extensions as { code?: string } | undefined)?.code;
  const msg = typeof first.message === 'string' ? first.message : '';
  const lower = msg.toLowerCase();
  if (code === 'GRAPHQL_VALIDATION_FAILED') {
    return (
      /subtasks|usertodosubtask|organizationprojecttodosubtask|createusertodosubtask|createorganizationprojecttodosubtask/.test(
        lower
      ) ||
      (/unknown field|cannot query field|unknown type/i.test(lower) &&
        /subtask|checklist/i.test(lower))
    );
  }
  return false;
}
