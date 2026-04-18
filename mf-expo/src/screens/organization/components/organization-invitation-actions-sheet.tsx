/**
 * Bottom sheet: org admin/owner resends or revokes a pending invitation.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { t } from '@/src/shared/i18n';
import type { OrganizationInvitationPayload } from '@/src/shared/services/mf-go-api';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useState } from 'react';
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

type Step = 'menu' | 'confirmRevoke';

export interface OrganizationInvitationActionsSheetProps {
  visible: boolean;
  invitation: OrganizationInvitationPayload | null;
  organizationName: string;
  onClose: () => void;
  onResend: (invitationId: string) => Promise<void>;
  onRevoke: (invitationId: string) => Promise<void>;
}

export function OrganizationInvitationActionsSheet({
  visible,
  invitation,
  organizationName,
  onClose,
  onResend,
  onRevoke,
}: OrganizationInvitationActionsSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('menu');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('menu');
      setBusy(false);
    }
  }, [visible, invitation?.id]);

  const email = invitation?.inviteeEmail?.trim() ?? '';

  const handleResend = useCallback(async () => {
    if (!invitation || busy) return;
    setBusy(true);
    try {
      await onResend(invitation.id);
      onClose();
    } catch {
      /* parent surfaced alert */
    } finally {
      setBusy(false);
    }
  }, [invitation, busy, onResend, onClose]);

  const handleRevokeConfirmed = useCallback(async () => {
    if (!invitation || busy) return;
    setBusy(true);
    try {
      await onRevoke(invitation.id);
      onClose();
    } catch {
      /* parent surfaced alert */
    } finally {
      setBusy(false);
    }
  }, [invitation, busy, onRevoke, onClose]);

  if (!visible || !invitation) {
    return null;
  }

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

            {step === 'menu' ? (
              <>
                <Text style={[styles.title, { color: colors.bodyText }]}>
                  {t('profile.organizations.detail.invitationActionsTitle')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.labelText }]}>
                  {t('profile.organizations.detail.invitationActionsSubtitle', {
                    email,
                    organization: organizationName,
                  })}
                </Text>

                <Pressable
                  onPress={handleResend}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.actionRow,
                    {
                      backgroundColor: colors.surfaceBackground,
                      borderColor: colors.surfaceBorder,
                      opacity: busy ? 0.5 : pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Ionicons name="mail-outline" size={22} color={colors.tint} />
                  <Text style={[styles.actionRowText, { color: colors.tint }]}>
                    {t('profile.organizations.detail.resendInvitation')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setStep('confirmRevoke')}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.actionRow,
                    {
                      backgroundColor: colors.surfaceBackground,
                      borderColor: colors.surfaceBorder,
                      opacity: busy ? 0.5 : pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Ionicons name="close-circle-outline" size={22} color="#C00" />
                  <Text style={[styles.actionRowText, { color: '#C00' }]}>
                    {t('profile.organizations.detail.revokeInvitation')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onClose}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    { borderColor: colors.surfaceBorder, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.bodyText }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: colors.bodyText }]}>
                  {t('profile.organizations.detail.revokeInvitationConfirmTitle')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.labelText }]}>
                  {t('profile.organizations.detail.revokeInvitationConfirmMessage', {
                    email,
                    organization: organizationName,
                  })}
                </Text>
                <View style={styles.confirmRow}>
                  <Pressable
                    onPress={() => !busy && setStep('menu')}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      {
                        borderColor: colors.surfaceBorder,
                        backgroundColor: colors.surface,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.bodyText }]}>
                      {t('common.cancel')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleRevokeConfirmed}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.dangerBtn,
                      { opacity: busy ? 0.6 : pressed ? 0.9 : 1 },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.dangerBtnText}>{t('common.confirm')}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
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
  title: { fontSize: 19, fontWeight: '700', marginBottom: 6, paddingRight: 40 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  actionRowText: { fontSize: 17, fontWeight: '600', flex: 1 },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 17, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryBtnText: { fontSize: 17, fontWeight: '600' },
  dangerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#C00',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  dangerBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
