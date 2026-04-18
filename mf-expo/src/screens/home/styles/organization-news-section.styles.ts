import { Sizing, typographyHelper } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

const getTypographyStyle = (fontSize: string, fontWeight: string, lineHeight: string = 'normal') =>
  (typographyHelper as any).fromSizing?.createStyle(Sizing, fontSize, fontWeight, lineHeight) || {};

export const organizationNewsSectionStyles = StyleSheet.create({
  section: {
    marginBottom: Sizing.padding.l,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Sizing.padding.s,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizing.gap.s,
    flex: 1,
    marginRight: 8,
  },
  sectionTitle: {
    ...getTypographyStyle('m', 'semibold', 'normal'),
  },
  description: {
    ...getTypographyStyle('s', 'regular', 'normal'),
    marginBottom: Sizing.padding.s,
  },
  iconButton: {
    padding: Sizing.padding.xs,
    marginRight: -Sizing.padding.xs,
  },
  list: {
    gap: Sizing.gap.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  /** Fixed column: thumbnail or accent + icon — taller frame so cover crop reads better (GFG-19). */
  rowLead: {
    width: 92,
    alignItems: 'center',
  },
  rowThumbnail: {
    width: 92,
    height: 108,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rowThumbnailPlaceholder: {
    width: 92,
    height: 108,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  orgBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  rowDesc: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 6,
  },
  emptyState: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    ...getTypographyStyle('s', 'regular', 'normal'),
    textAlign: 'center',
  },
  footerHint: {
    fontSize: 12,
    marginTop: Sizing.padding.s,
    textAlign: 'center',
  },
});
