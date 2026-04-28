/**
 * Simple titled message sheet — same visual language as OTPBottomSheet / SignOutConfirmSheet.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/src/shared/i18n';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';

export type MessageBottomSheetVariant = 'info' | 'success' | 'error';

export interface MessageSheetAction {
  label: string;
  onPress: () => void;
  /** Uses danger styling (e.g. confirm delete). */
  destructive?: boolean;
}

export interface MessageBottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  message: string;
  variant?: MessageBottomSheetVariant;
  primaryAction: MessageSheetAction;
  secondaryAction?: MessageSheetAction;
}

function iconForVariant(variant: MessageBottomSheetVariant) {
  switch (variant) {
    case 'success':
      return { name: 'checkmark-circle' as const, color: '#34C759' };
    case 'error':
      return { name: 'alert-circle' as const, color: '#FF3B30' };
    default:
      return { name: 'information-circle' as const, color: '#007AFF' };
  }
}

export function MessageBottomSheet({
  visible,
  onDismiss,
  title,
  message,
  variant = 'info',
  primaryAction,
  secondaryAction,
}: MessageBottomSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const tint = colors.tint;
  const icon = iconForVariant(variant);
  const primaryTextColor = isDark ? '#000000' : '#FFFFFF';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.surfaceBorder,
              paddingBottom: Math.max(insets.bottom, Sizing.padding.l),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: icon.color + '22' }]}>
              <Ionicons name={icon.name} size={28} color={icon.color} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={[styles.title, { color: colors.bodyText }]}>{title}</Text>
            </View>
            <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button">
              <Ionicons name="close-circle" size={28} color={colors.labelText} />
            </Pressable>
          </View>

          <Text style={[styles.message, { color: colors.bodyText }]}>{message}</Text>

          <View style={secondaryAction ? styles.buttonRow : styles.buttonCol}>
            {secondaryAction ? (
              <Pressable
                onPress={secondaryAction.onPress}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.bodyText }]}>
                  {secondaryAction.label}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={primaryAction.onPress}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: primaryAction.destructive ? '#FF3B30' : tint,
                  opacity: pressed ? 0.9 : 1,
                  flex: secondaryAction ? 1 : undefined,
                  width: secondaryAction ? undefined : '100%',
                },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: primaryTextColor }]}>{primaryAction.label}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Convenience: single OK sheet (localized). */
export function okSheetAction(onPress: () => void): MessageSheetAction {
  return { label: t('common.ok'), onPress };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
    ...(Platform.OS === 'android' && { elevation: 999 }),
  },
  sheet: {
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    paddingHorizontal: Sizing.padding.xl,
    paddingTop: Sizing.padding.m,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    ...(Platform.OS === 'android' && { elevation: 1000 }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
    marginBottom: Sizing.padding.l,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Sizing.padding.m,
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.92,
    marginBottom: Sizing.padding.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Sizing.gap.m,
  },
  buttonCol: {
    gap: Sizing.gap.m,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
  },
  primaryBtn: {
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
