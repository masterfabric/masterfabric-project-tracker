/** Compact feedback thread id for list/detail badges (first 8 hex chars of UUID, uppercase). */
export function shortFeedbackThreadId(uuid: string | undefined): string {
  if (!uuid) return '';
  const compact = uuid.replace(/-/g, '');
  if (compact.length < 8) return uuid;
  return compact.slice(0, 8).toUpperCase();
}
