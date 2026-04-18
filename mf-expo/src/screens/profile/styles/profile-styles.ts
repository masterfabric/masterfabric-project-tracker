import { Platform, StyleSheet } from 'react-native';
import { Sizing } from 'masterfabric-expo-core';

const SECTION_INSET = 20;
const ROW_RADIUS = 10;
const ROW_HEIGHT = 44;

/** Outer box: inner content is OUTER − 2×border (102 − 6 = 96) so the photo clip stays a perfect circle. */
export const PROFILE_AVATAR_OUTER = 102;
export const PROFILE_AVATAR_INNER = 96;
export const PROFILE_AVATAR_BORDER = 3;

export const profileStyles = StyleSheet.create({
  container: {
    flex: Sizing.flexNumber.full,
  },
  content: {
    flex: Sizing.flexNumber.full,
  },
  contentContainer: {
    paddingHorizontal: SECTION_INSET,
    paddingTop: 24,
    paddingBottom: Sizing.padding.xxl,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  /** Ring: border draws outside the inner clip so the photo isn’t clipped by the stroke. */
  avatarOuterRing: {
    width: PROFILE_AVATAR_OUTER,
    height: PROFILE_AVATAR_OUTER,
    borderRadius: PROFILE_AVATAR_OUTER / 2,
    borderWidth: PROFILE_AVATAR_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  /** Hard clip for circular image (required on Android; helps iOS antialiasing). */
  avatarInnerClip: {
    width: PROFILE_AVATAR_INNER,
    height: PROFILE_AVATAR_INNER,
    borderRadius: PROFILE_AVATAR_INNER / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: PROFILE_AVATAR_INNER,
    height: PROFILE_AVATAR_INNER,
    borderRadius: PROFILE_AVATAR_INNER / 2,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '600',
  },
  userName: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  userNickname: {
    fontSize: 15,
    marginTop: 4,
    opacity: 0.85,
  },
  adminBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'center',
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  userEmail: {
    fontSize: 15,
    opacity: 0.7,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 8,
    marginTop: 24,
    paddingHorizontal: 4,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
    opacity: 0.9,
  },
  sectionHeaderFirst: {
    marginTop: 0,
  },
  groupedSection: {
    borderRadius: ROW_RADIUS,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ROW_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '400',
  },
  rowChevron: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  errorContainer: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
