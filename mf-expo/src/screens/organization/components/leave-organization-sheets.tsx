/**
 * Bottom sheets: leave organization (non-owner) and owner notice.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { t } from '@/src/shared/i18n';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface LeaveOrganizationConfirmSheetProps {
  visible: boolean;
  organizationName: string;
  onClose: () => void;
  onConfirmLeave: () => Promise<void>;
}

export function LeaveOrganizationConfirmSheet({
  visible,
  organizationName,
  onClose,
  onConfirmLeave,
}: LeaveOrganizationConfirmSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (visible) setBusy(false);
  }, [visible]);

  if (!visible) return null;

  const runLeave = async () => {
    setBusy(true);
    try {
      await onConfirmLeave();
      onClose();
    } catch {
      /* parent surfaced alert */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={busy ? undefined : onClose}
    >
      <Pressable style={styles.overlay} onPress={busy ? undefined : onClose}>
        <AdaptiveKeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
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
            <Pressable
              onPress={busy ? undefined : onClose}
              disabled={busy}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityLabel={t('accessibility.closeModal')}
            >
              <Ionicons name="close" size={24} color={colors.bodyText} />
            </Pressable>
            <Text style={[styles.title, { color: colors.bodyText }]}>
              {t('profile.organizations.detail.leaveOrganization')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('profile.organizations.detail.leaveOrganizationHint', { name: organizationName })}
            </Text>
            <Pressable
              onPress={runLeave}
              disabled={busy}
              style={({ pressed }) => [
                styles.leaveBtn,
                {
                  backgroundColor: '#C00',
                  opacity: busy ? 0.55 : pressed ? 0.88 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.leaveBtnText}>
                  {t('profile.organizations.detail.leaveOrganizationConfirm')}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={onClose}
              disabled={busy}
              style={({ pressed }) => [
                styles.cancelBtn,
                { borderColor: colors.surfaceBorder, opacity: busy ? 0.5 : pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.bodyText }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </Pressable>
        </AdaptiveKeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

export interface OwnerCannotLeaveSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function OwnerCannotLeaveSheet({ visible, onClose }: OwnerCannotLeaveSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <AdaptiveKeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
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
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityLabel={t('accessibility.closeModal')}
            >
              <Ionicons name="close" size={24} color={colors.bodyText} />
            </Pressable>
            <Text style={[styles.title, { color: colors.bodyText }]}>
              {t('profile.organizations.detail.ownerCannotLeaveTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('profile.organizations.detail.ownerCannotLeaveMessage')}
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: onTint }]}>{t('common.ok')}</Text>
            </Pressable>
          </Pressable>
        </AdaptiveKeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
    ...(Platform.OS === 'android' && { elevation: 999 }),
  },
  keyboardView: { flex: 1, justifyContent: 'flex-end' },
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
  closeButton: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  title: { fontSize: 19, fontWeight: '700', marginBottom: 8, paddingRight: 40 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  leaveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  leaveBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 17, fontWeight: '600' },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700' },
});
