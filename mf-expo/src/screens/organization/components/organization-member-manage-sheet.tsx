/**
 * Bottom sheet: admin/owner actions for another member (suspend, remove).
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { t } from '@/src/shared/i18n';
import type { OrganizationMemberPayload } from '@/src/shared/services/mf-go-api';
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

type Step = 'menu' | 'confirmRemove';

export interface OrganizationMemberManageSheetProps {
  visible: boolean;
  member: OrganizationMemberPayload | null;
  organizationName: string;
  onClose: () => void;
  onSetSuspended: (userId: string, suspended: boolean) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}

export function OrganizationMemberManageSheet({
  visible,
  member,
  organizationName,
  onClose,
  onSetSuspended,
  onRemove,
}: OrganizationMemberManageSheetProps) {
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
  }, [visible, member?.userID]);

  const displayName =
    member?.userNickname?.trim() ||
    (member ? `@${member.userID.slice(0, 8)}…` : '');

  const handleSuspendToggle = useCallback(async () => {
    if (!member || busy) return;
    setBusy(true);
    try {
      await onSetSuspended(member.userID, member.membershipStatus !== 'SUSPENDED');
      onClose();
    } catch {
      /* parent surfaced alert */
    } finally {
      setBusy(false);
    }
  }, [member, busy, onSetSuspended, onClose]);

  const handleRemoveConfirmed = useCallback(async () => {
    if (!member || busy) return;
    setBusy(true);
    try {
      await onRemove(member.userID);
      onClose();
    } catch {
      /* parent surfaced alert */
    } finally {
      setBusy(false);
    }
  }, [member, busy, onRemove, onClose]);

  if (!visible || !member) {
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
                  {t('profile.organizations.detail.memberActionsTitle')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.labelText }]}>
                  {t('profile.organizations.detail.memberActionsSubtitle', {
                    name: displayName,
                    organization: organizationName,
                  })}
                </Text>

                {member.membershipStatus === 'SUSPENDED' ? (
                  <SheetActionRow
                    label={t('profile.organizations.detail.activateMember')}
                    icon="play-circle-outline"
                    colors={colors}
                    onPress={handleSuspendToggle}
                    disabled={busy}
                  />
                ) : (
                  <SheetActionRow
                    label={t('profile.organizations.detail.suspendMember')}
                    icon="pause-circle-outline"
                    colors={colors}
                    onPress={handleSuspendToggle}
                    disabled={busy}
                  />
                )}

                <SheetActionRow
                  label={t('profile.organizations.detail.removeMember')}
                  icon="person-remove-outline"
                  colors={colors}
                  destructive
                  onPress={() => setStep('confirmRemove')}
                  disabled={busy}
                />

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
                  {t('profile.organizations.detail.removeMemberConfirmTitle')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.labelText }]}>
                  {t('profile.organizations.detail.removeMemberConfirmMessage', {
                    name: displayName,
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
                    onPress={handleRemoveConfirmed}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.dangerBtn,
                      { opacity: busy ? 0.6 : pressed ? 0.9 : 1 },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.dangerBtnText}>{t('common.delete')}</Text>
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

function SheetActionRow({
  label,
  icon,
  colors,
  destructive,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: ReturnType<typeof getThemeColors>;
  destructive?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const tint = destructive ? '#C00' : colors.tint;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionRow,
        {
          backgroundColor: colors.surfaceBackground,
          borderColor: colors.surfaceBorder,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={tint} />
      <Text style={[styles.actionRowText, { color: tint }]}>{label}</Text>
    </Pressable>
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
