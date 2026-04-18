import { Sizing } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

export const stepControlsStyles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
  },
  bar: {
    flexDirection: Sizing.layout.flexDirection.row,
    alignItems: Sizing.layout.alignItems.center,
    justifyContent: Sizing.layout.justifyContent.spaceBetween,
    width: '100%',
    minHeight: 36,
  },
  /** Left slot: text back button width is reserved on step 1 via hidden measure */
  leadingWrap: {
    flexShrink: 0,
    flexGrow: 0,
    alignItems: Sizing.layout.alignItems.flexStart,
    justifyContent: Sizing.layout.justifyContent.center,
  },
  backTextPressable: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    minHeight: 36,
    borderRadius: 6,
    justifyContent: Sizing.layout.justifyContent.center,
    alignItems: Sizing.layout.alignItems.center,
  },
  backTextLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  /** Trailing control: width hugs label + padding, not full-width row */
  trailingWrap: {
    flexShrink: 0,
    flexGrow: 0,
    alignItems: Sizing.layout.alignItems.flexEnd,
  },
  /** Primary text button: squared corners, tight padding (7 / 13) */
  nextChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    minHeight: 36,
    borderRadius: 6,
    justifyContent: Sizing.layout.justifyContent.center,
    alignItems: Sizing.layout.alignItems.center,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  nextChipLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
});
