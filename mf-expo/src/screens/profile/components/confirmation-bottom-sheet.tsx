import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ConfirmationBottomSheetProps {
  visible: boolean;
  title: string;
  /** Primary explanation under the title. */
  message?: string;
  /** Optional scrollable block between message and buttons (e.g. detailed checklist). */
  extraContent?: React.ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  /** Called when user confirms; return a Promise to show loading on confirm until it settles. */
  onConfirm: () => void | Promise<void>;
  /** When true, confirm button uses error/destructive styling. */
  destructive?: boolean;
  loading?: boolean;
}

type InnerProps = Omit<ConfirmationBottomSheetProps, 'visible'>;

function ConfirmationBottomSheetInner({
  title,
  message,
  extraContent,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  destructive = false,
  loading = false,
}: InnerProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const bottomPad = Math.max(insets.bottom, Sizing.padding.m);
  /** Cap sheet so it never draws off the top of the screen when content is long. */
  const sheetMaxHeight = Math.min(windowHeight * 0.9, windowHeight - Math.max(insets.top, 12) - 8);
  /**
   * Scrollable body: shorter when there is no `extraContent` (minimal confirm sheets),
   * taller when a checklist/list is embedded so one ScrollView scrolls reliably.
   */
  const chromeReserve = extraContent ? 200 : 168;
  const scrollViewportFrac = extraContent ? 0.52 : 0.36;
  const scrollMaxHeight = Math.min(
    windowHeight * scrollViewportFrac,
    Math.max(96, sheetMaxHeight - bottomPad - chromeReserve)
  );

  const confirmBg = destructive
    ? colors.errorColor || '#FF3B30'
    : colors.tint;
  const confirmTextColor = destructive ? '#FFFFFF' : onTint;

  return (
    <Pressable
      style={styles.overlay}
      onPress={loading ? undefined : onCancel}
    >
      <Pressable
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            borderColor: colors.surfaceBorder,
            maxHeight: sheetMaxHeight,
            paddingBottom: bottomPad,
          },
        ]}
        onPress={(e) => e.stopPropagation()}
      >
        <View style={styles.handle} />
        <Text style={[styles.title, { color: colors.bodyText }]}>{title}</Text>
        {message || extraContent ? (
          <ScrollView
            style={[styles.sheetBodyScroll, { maxHeight: scrollMaxHeight, flexGrow: 0 }]}
            contentContainerStyle={[
              styles.sheetBodyScrollContent,
              !extraContent && styles.sheetBodyScrollContentMessageOnly,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={!!extraContent || ((message?.length ?? 0) > 280)}
            bounces
            nestedScrollEnabled={!!extraContent}
          >
            {message ? (
              <Text style={[styles.message, { color: colors.labelText }]}>{message}</Text>
            ) : null}
            {extraContent}
          </ScrollView>
        ) : null}

        <View style={styles.buttonRow}>
          <Pressable
            onPress={onCancel}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              styles.cancelButton,
              {
                backgroundColor: colors.surfaceBackground,
                borderColor: colors.surfaceBorder,
                opacity: loading ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.bodyText }]}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            onPress={() => void onConfirm()}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: confirmBg,
                opacity: loading ? 0.7 : pressed ? 0.9 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={confirmTextColor} />
            ) : (
              <Text style={[styles.buttonText, { color: confirmTextColor }]}>{confirmLabel}</Text>
            )}
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

/**
 * Same UI as {@link ConfirmationBottomSheet} but without a Modal — use **inside** another Modal
 * (React Native often fails to show a second stacked Modal).
 */
export function ConfirmationBottomSheetOverlay({
  visible,
  ...rest
}: ConfirmationBottomSheetProps) {
  if (!visible) return null;
  return (
    <View
      style={[StyleSheet.absoluteFillObject, styles.overlayHost]}
      pointerEvents="box-none"
    >
      <ConfirmationBottomSheetInner {...rest} />
    </View>
  );
}

/**
 * Lightweight bottom sheet for yes/no confirmations (replaces system Alert for in-app consistency).
 */
export function ConfirmationBottomSheet({
  visible,
  ...rest
}: ConfirmationBottomSheetProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={rest.loading ? undefined : rest.onCancel}
    >
      <ConfirmationBottomSheetInner {...rest} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayHost: {
    zIndex: 2000,
    elevation: 2000,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    paddingHorizontal: Sizing.padding.xl,
    paddingTop: Sizing.padding.m,
    borderTopWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
    marginBottom: Sizing.padding.l,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Sizing.gap.s,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Sizing.padding.s,
  },
  sheetBodyScroll: {
    marginBottom: Sizing.padding.m,
  },
  sheetBodyScrollContent: {
    paddingBottom: Sizing.padding.xs,
  },
  sheetBodyScrollContentMessageOnly: {
    flexGrow: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Sizing.padding.s,
    flexShrink: 0,
  },
  button: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
