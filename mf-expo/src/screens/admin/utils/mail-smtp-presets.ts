/**
 * Common consumer / hosted SMTP presets for admin quick setup.
 * Port 587 + STARTTLS (implicitTLS false) matches most providers’ recommended setup.
 */

export type MailSmtpProviderId = 'gmail' | 'yandex' | 'outlook' | 'icloud' | 'custom';

export interface SmtpPreset {
  host: string;
  port: number;
  implicitTLS: boolean;
  plainNoTLS: boolean;
}

export const SMTP_PROVIDER_ORDER: MailSmtpProviderId[] = [
  'gmail',
  'yandex',
  'outlook',
  'icloud',
  'custom',
];

export const SMTP_PRESETS: Record<Exclude<MailSmtpProviderId, 'custom'>, SmtpPreset> = {
  gmail: { host: 'smtp.gmail.com', port: 587, implicitTLS: false, plainNoTLS: false },
  yandex: { host: 'smtp.yandex.com', port: 587, implicitTLS: false, plainNoTLS: false },
  outlook: { host: 'smtp.office365.com', port: 587, implicitTLS: false, plainNoTLS: false },
  icloud: { host: 'smtp.mail.me.com', port: 587, implicitTLS: false, plainNoTLS: false },
};

export function inferMailProviderFromEmail(email: string): MailSmtpProviderId {
  const domain = email.split('@')[1]?.toLowerCase().trim() ?? '';
  if (['gmail.com', 'googlemail.com'].includes(domain)) return 'gmail';
  if (['yandex.com', 'yandex.ru', 'ya.ru', 'yandex.kz', 'narod.ru'].includes(domain)) return 'yandex';
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) return 'outlook';
  if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) return 'icloud';
  return 'custom';
}

export function inferMailProviderFromHost(host: string): MailSmtpProviderId {
  const h = host.trim().toLowerCase();
  if (!h) return 'custom';
  if (h.includes('gmail')) return 'gmail';
  if (h.includes('yandex')) return 'yandex';
  if (h.includes('office365') || h.includes('outlook.office')) return 'outlook';
  if (h.includes('mail.me.com')) return 'icloud';
  return 'custom';
}

export function getPresetForProvider(id: MailSmtpProviderId): SmtpPreset | null {
  if (id === 'custom') return null;
  return SMTP_PRESETS[id];
}
