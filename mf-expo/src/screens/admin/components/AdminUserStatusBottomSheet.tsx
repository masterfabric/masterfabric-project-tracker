/**
 * Activate / deactivate (pasif) confirmation — bottom sheet aligned with AdminDeleteUserBottomSheet.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoAdmin } from '@/src/shared/services';
import type { AdminUserProfile, UserStatus } from '@/src/shared/services/mf-go-api';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import { adminStatusLabel } from '../utils/admin-user-labels';

export type AdminStatusSheetTarget = {
  user: AdminUserProfile;
  newStatus: UserStatus;
} | null;

interface AdminUserStatusBottomSheetProps {
  target: AdminStatusSheetTarget;
  onClose: () => void;
  /** Called after the API succeeds; sheet closes right after. */
  onApplied: (userId: string, newStatus: UserStatus) => void;
  /** Optional: disable list row actions while the mutation runs */
  onBusy?: (userId: string | null) => void;
}

export function AdminUserStatusBottomSheet({
  target,
  onClose,
  onApplied,
  onBusy,
}: AdminUserStatusBottomSheetProps) {
  useLocale();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const sheetMaxH = Math.round(
    Math.min(winH * Sizing.modal.sheetMaxHeightFraction, winH - Math.max(insets.top, 8))
  );

  const visible = target !== null;
  const user = target?.user ?? null;
  const newStatus = target?.newStatus ?? null;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const isActivate = newStatus === 'ACTIVE';

  const handleConfirm = useCallback(async () => {
    if (!user || !newStatus) return;
    setError(null);
    setSubmitting(true);
    onBusy?.(user.id);
    try {
      await mfGoAdmin.setUserStatus(user.id, newStatus);
      onApplied(user.id, newStatus);
      onClose();
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
    } finally {
      setSubmitting(false);
      onBusy?.(null);
    }
  }, [user, newStatus, onApplied, onClose, onBusy]);

  const title = isActivate
    ? t('settings.adminUserManagement.statusConfirmActivateTitle')
    : t('settings.adminUserManagement.statusConfirmDeactivateTitle');
  const message = isActivate
    ? t('settings.adminUserManagement.statusConfirmActivateMessage', { email: user?.email ?? '' })
    : t('settings.adminUserManagement.statusConfirmDeactivateMessage', { email: user?.email ?? '' });

  const confirmBg = isActivate ? colors.tint : '#FF9500';
  const iconBg = isActivate ? colors.tint + '22' : '#FF950022';
  const iconColor = isActivate ? colors.tint : '#FF9500';
  const iconName = isActivate ? 'play-circle' : 'pause-circle';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <Pressable
        style={styles.overlay}
        onPress={submitting ? undefined : onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <AdaptiveKeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                maxHeight: sheetMaxH,
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
              disabled={submitting}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityLabel={t('accessibility.closeModal')}
            >
              <Ionicons name="close" size={24} color={colors.bodyText} />
            </Pressable>

            <View style={styles.headerRow}>
              <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                <Ionicons name={iconName} size={28} color={iconColor} />
              </View>
              <View style={styles.headerText}>
                <Text
                  style={[
                    styles.sheetTitle,
                    { color: colors.bodyText },
                    Platform.OS === 'android' ? { includeFontPadding: false } : null,
                  ]}
                >
                  {title}
                </Text>
                {user ? (
                  <Text style={[styles.subtitle, { color: colors.labelText }]} numberOfLines={2}>
                    {user.email}
                  </Text>
                ) : null}
              </View>
            </View>

            <Text style={[styles.message, { color: colors.bodyText }]}>{message}</Text>

            {user && newStatus ? (
              <View
                style={[
                  styles.hintPill,
                  { backgroundColor: colors.surfaceBackground, borderColor: colors.surfaceBorder },
                ]}
              >
                <Text style={[styles.hintPillText, { color: colors.labelText }]}>
                  {t('settings.adminUserManagement.statusSheetTransition')}:{' '}
                  <Text style={{ color: colors.bodyText, fontWeight: '600' }}>
                    {adminStatusLabel(user.status)}
                  </Text>
                  {' → '}
                  <Text style={{ color: isActivate ? colors.tint : '#FF9500', fontWeight: '600' }}>
                    {adminStatusLabel(newStatus)}
                  </Text>
                </Text>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={onClose}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: colors.surfaceBorder,
                    backgroundColor: colors.surface,
                    opacity: submitting ? 0.5 : pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.bodyText }]}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirm()}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.confirmButton,
                  {
                    backgroundColor: confirmBg,
                    opacity: submitting ? 0.55 : pressed ? 0.88 : 1,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={isActivate ? onTint : '#FFFFFF'} />
                ) : (
                  <Text style={[styles.confirmButtonText, { color: isActivate ? onTint : '#FFFFFF' }]}>
                    {t('common.confirm')}
                  </Text>
                )}
              </Pressable>
            </View>
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
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    alignSelf: 'flex-end',
    overflow: 'hidden',
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
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: Sizing.padding.s,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 28,
    paddingTop: Platform.OS === 'android' ? 2 : 0,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Sizing.padding.m,
  },
  hintPill: {
    padding: Sizing.padding.m,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Sizing.padding.m,
  },
  hintPillText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: Sizing.padding.m,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Sizing.padding.s,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
