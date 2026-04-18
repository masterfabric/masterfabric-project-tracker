-- Remove only rows that still match shipped default keys (operators may delete manually instead).
DELETE FROM app_settings
WHERE key IN ('public_help_faq_markdown', 'public_privacy_policy_markdown');
