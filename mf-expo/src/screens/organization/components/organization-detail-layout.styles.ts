/**
 * Shared layout for organization detail screen + loading skeleton (same spacing and chrome).
 */

import { StyleSheet } from 'react-native';
import { Sizing } from 'masterfabric-expo-core';

export const orgDetailLayoutStyles = StyleSheet.create({
  content: { flex: 1 },
  /** Matches rendered scroll: horizontal padding + top aligned with loaded screen (14). */
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Sizing.padding.xxl,
  },
  orgLogoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  orgLogoClip: {
    width: Sizing.avatar.xxxl,
    height: Sizing.avatar.xxxl,
    borderRadius: Sizing.avatar.xxxl / 2,
    overflow: 'hidden',
  },
  orgLogoImage: {
    width: '100%',
    height: '100%',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 8,
    marginTop: 24,
    paddingHorizontal: 4,
  },
  memberSectionTitle: { marginTop: 28, marginBottom: 12 },
  invitationsSectionTitle: { marginTop: 28, marginBottom: 12 },
  groupedSection: { borderRadius: 10, overflow: 'hidden' },
  memberGroupedSection: { paddingVertical: 6 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  emptyRowText: { fontSize: 15 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  memberInitials: { fontSize: 14, fontWeight: '600' },
  memberInfo: { flex: 1 },
  memberId: { fontSize: 16, fontWeight: '500' },
  memberRole: { fontSize: 13, marginTop: 5, lineHeight: 18 },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 10,
  },
  inviteRowText: { flex: 1, fontSize: 17, fontWeight: '500' },
  cardBlock: { padding: 16 },
  cardRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000010',
  },
  cardLabel: { fontSize: 12, marginBottom: 4 },
  cardBody: { fontSize: 15 },
  cardLink: { fontSize: 15 },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 10,
  },
  secondaryRowText: { flex: 1, fontSize: 16, fontWeight: '500' },
  newsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 20,
  },
  muted: { fontSize: 14, paddingHorizontal: 4, marginBottom: 8 },
  newsItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  newsTitle: { fontSize: 16, fontWeight: '600' },
  newsDesc: { fontSize: 14, marginTop: 4 },
  newsMeta: { fontSize: 12, marginTop: 6 },
  newsActions: { flexDirection: 'row', gap: 12 },
});

/** Same separators as member / invitation rows on the real screen (not hairline). */
export function orgDetailListRowSeparator(isDark: boolean, index: number, total: number) {
  if (index >= total - 1) return null;
  return {
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
  };
}
