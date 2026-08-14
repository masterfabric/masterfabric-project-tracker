/**
 * MasterFabric Tracker — shared brand tokens (JS).
 * Source of truth for CSS: ../tokens.css
 * Inspired by masterfabric.co: Inter, slate-800 mark, gray-900 body, white surfaces.
 */
export const mfBrand = {
  /** Logo / primary ink — slate-800 */
  brand: "#1E293B",
  /** Soft brand — slate-500 */
  brandSoft: "#64748B",
  /** Muted tag — gray-500 */
  brandTag: "#6B7280",
  /** Body text — gray-900 */
  text: "#111827",
  /** CTA fill (matches brand ink; not blue SaaS) */
  accent: "#1E293B",
  accentHover: "#0F172A",
  /** Canvas / paper */
  background: "#FAFAFA",
  card: "#FFFFFF",
  border: "#E4E4E7",
  muted: "#F4F4F5",
  radius: "0.375rem",
  fontSans: "Inter",
  fontMono: "JetBrains Mono",
} as const;

export type MfBrandTokens = typeof mfBrand;
