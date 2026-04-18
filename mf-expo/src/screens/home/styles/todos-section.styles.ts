import { Sizing, typographyHelper } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

const getTypographyStyle = (fontSize: string, fontWeight: string, lineHeight: string = 'normal') =>
  (typographyHelper as any).fromSizing?.createStyle(Sizing, fontSize, fontWeight, lineHeight) || {};

export const todosSectionStyles = StyleSheet.create({
  section: {
    marginBottom: Sizing.padding.l,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Sizing.padding.s,
    paddingHorizontal: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizing.gap.s,
  },
  sectionTitle: {
    ...getTypographyStyle('m', 'semibold', 'normal'),
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  countCompleted: {
    fontSize: 14,
    fontWeight: '600',
  },
  countSeparator: {
    fontSize: 14,
    fontWeight: '500',
  },
  countTotal: {
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    ...getTypographyStyle('s', 'regular', 'normal'),
    marginBottom: Sizing.padding.s,
    paddingHorizontal: 0,
  },
  filterHint: {
    ...getTypographyStyle('xs', 'regular', 'normal'),
    marginBottom: 6,
    paddingHorizontal: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Sizing.gap.m,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  /** Org name chips: parent width cap so long names ellipsize like All / Personal */
  filterOrgChip: {
    overflow: 'hidden',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  iconButton: {
    padding: Sizing.padding.xs,
    marginRight: -Sizing.padding.xs,
  },
  list: {
    gap: Sizing.gap.s,
  },
  todoCheckboxWrap: {
    marginTop: 2,
  },
  /** Top-align so multi-line title + meta column align with checkbox / emoji */
  todoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 8,
    overflow: 'hidden',
  },
  /** Trailing drag handle (suffix of row) */
  dragHandle: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginLeft: 2,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  emojiPrefix: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  emojiText: {
    fontSize: 16,
  },
  todoItemContent: {
    flex: 1,
    minWidth: 0,
  },
  todoTitle: {
    ...getTypographyStyle('s', 'regular', 'normal'),
    fontSize: 15,
    lineHeight: 20,
  },
  /** Organization + assignee: stacked rows (semantic, screen-reader friendly) */
  todoMetaColumn: {
    marginTop: 4,
    gap: 3,
    alignSelf: 'stretch',
  },
  todoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  todoMetaIcon: {
    marginRight: 2,
  },
  todoMetaValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  todoTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  emptyState: {
    paddingVertical: Sizing.padding.xl,
    paddingHorizontal: Sizing.padding.l,
    borderRadius: 14,
    alignItems: 'center',
  },
  emptyText: {
    ...getTypographyStyle('s', 'regular', 'normal'),
    textAlign: 'center',
  },
  expandButton: {
    alignSelf: 'center',
    paddingVertical: Sizing.padding.m,
    paddingHorizontal: Sizing.padding.l,
  },
  draggableList: {
    flexGrow: 0,
    overflow: 'visible',
    zIndex: 1,
  },
  /**
   * Project todo on home: **column** card (do not reuse `todoItem` here — that style is `row` and
   * would place subtasks beside the main row).
   */
  projectTodoCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  projectTodoMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    alignSelf: 'stretch',
  },
  /** Indented to match title column (checkbox + gaps + emoji). */
  projectTodoSubtasksPreview: {
    marginTop: 10,
    alignSelf: 'stretch',
    marginLeft: 68,
    paddingRight: 2,
    gap: 6,
  },
  projectTodoSubtasksPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  projectTodoSubtaskPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    alignSelf: 'stretch',
  },
  projectTodoSubtaskPreviewText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 19,
  },
});
