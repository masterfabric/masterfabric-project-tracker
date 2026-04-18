/**
 * mf-go `adminUpsertAppSetting` keys (set `isPublic: true`) for in-app Help & Privacy.
 * Bodies are Markdown; shown on /help-faq and /privacy-policy.
 *
 * `*_tr` keys are optional Turkish bodies; when non-empty and app locale is Turkish,
 * the legal screens prefer them over the default (English) keys.
 */
export const PUBLIC_HELP_FAQ_MARKDOWN_KEY = 'public_help_faq_markdown';
export const PUBLIC_HELP_FAQ_MARKDOWN_KEY_TR = 'public_help_faq_markdown_tr';
export const PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY = 'public_privacy_policy_markdown';
export const PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY_TR = 'public_privacy_policy_markdown_tr';

/** Resolve which app_settings key to read for the current locale. */
export function resolvePublicLegalMarkdownKey(
  baseKey: string,
  locale: string,
  custom: Record<string, string>,
): string {
  const loc = (locale ?? 'en').toLowerCase();
  if (loc.startsWith('tr')) {
    const trKey =
      baseKey === PUBLIC_HELP_FAQ_MARKDOWN_KEY
        ? PUBLIC_HELP_FAQ_MARKDOWN_KEY_TR
        : baseKey === PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY
          ? PUBLIC_PRIVACY_POLICY_MARKDOWN_KEY_TR
          : `${baseKey}_tr`;
    const trVal = custom[trKey]?.trim();
    if (trVal) return trKey;
  }
  return baseKey;
}
