/**
 * Delete-user confirmation as a bottom sheet (matches AppInfoBottomSheet / settings style).
 * Loads adminUserDeletionImpact when confirming another user; self-delete shows a warning only.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoAdmin } from '@/src/shared/services';
import type { AdminUserDeletionImpact, AdminUserProfile } from '@/src/shared/services/mf-go-api';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';

export type AdminDeleteSheetTarget = AdminUserProfile | 'self' | null;

function buildDeletionImpactLines(impact: AdminUserDeletionImpact): string[] {
  const lines: string[] = [t('settings.adminUserManagement.deleteImpactWillRemove')];
  if (impact.ownedTodoCount > 0) {
    lines.push(t('settings.adminUserManagement.deleteImpactOwnedTodos', { count: impact.ownedTodoCount }));
  }
  if (impact.todoAssigneeClearCount > 0) {
    lines.push(
      t('settings.adminUserManagement.deleteImpactAssigneeTodos', {
        count: impact.todoAssigneeClearCount,
      })
    );
  }
  if (impact.organizationMembershipCount > 0) {
    lines.push(
      t('settings.adminUserManagement.deleteImpactMemberships', {
        count: impact.organizationMembershipCount,
      })
    );
  }
  for (const org of impact.ownedOrganizations) {
    lines.push(
      t('settings.adminUserManagement.deleteImpactOwnedOrg', {
        name: org.name,
        others: org.otherMemberCount,
      })
    );
  }
  if (impact.addressCount > 0) {
    lines.push(t('settings.adminUserManagement.deleteImpactAddresses', { count: impact.addressCount }));
  }
  if (impact.deviceCount > 0) {
    lines.push(t('settings.adminUserManagement.deleteImpactDevices', { count: impact.deviceCount }));
  }
  if (impact.hasUserSettings) {
    lines.push(t('settings.adminUserManagement.deleteImpactSettings'));
  }
  if (impact.notificationReadCount > 0) {
    lines.push(
      t('settings.adminUserManagement.deleteImpactNotifications', {
        count: impact.notificationReadCount,
      })
    );
  }
  if (impact.sessionCount > 0) {
    lines.push(t('settings.adminUserManagement.deleteImpactSessions', { count: impact.sessionCount }));
  }
  if (impact.userMessageCount > 0) {
    lines.push(t('settings.adminUserManagement.deleteImpactMessages', { count: impact.userMessageCount }));
  }
  if (impact.pendingInvitationAsInviterCount > 0) {
    lines.push(
      t('settings.adminUserManagement.deleteImpactInvites', {
        count: impact.pendingInvitationAsInviterCount,
      })
    );
  }
  return lines;
}

interface AdminDeleteUserBottomSheetProps {
  target: AdminDeleteSheetTarget;
  onClose: () => void;
  /** Called after the user is successfully removed from the backend */
  onDeleted: (userId: string) => void;
}

export function AdminDeleteUserBottomSheet({
  target,
  onClose,
  onDeleted,
}: AdminDeleteUserBottomSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  /** Same cap as AppInfo / broadcast-style sheets — avoids a near full-screen panel. */
  const sheetMaxH = Math.round(Math.min(winH * Sizing.modal.sheetMaxHeightFraction, winH - Math.max(insets.top, 8)));

  const visible = target !== null;
  const isSelf = target === 'self';
  const user = target !== null && target !== 'self' ? target : null;

  const [impactLoading, setImpactLoading] = useState(false);
  const [impact, setImpact] = useState<AdminUserDeletionImpact | null>(null);
  const [impactLoadFailed, setImpactLoadFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!visible || isSelf || !userId) {
      setImpact(null);
      setImpactLoadFailed(false);
      setImpactLoading(false);
      setDeleteError(null);
      return;
    }
    let cancelled = false;
    setImpactLoading(true);
    setImpact(null);
    setImpactLoadFailed(false);
    setDeleteError(null);
    mfGoAdmin
      .userDeletionImpact(userId)
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch(() => {
        if (!cancelled) setImpactLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setImpactLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, isSelf, userId]);

  const handleConfirmDelete = () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);
    void (async () => {
      try {
        await mfGoAdmin.deleteUser(user.id);
        onDeleted(user.id);
        onClose();
      } catch (e) {
        setDeleteError(getGraphQLErrorMessage(e));
      } finally {
        setDeleting(false);
      }
    })();
  };

  const cardStyle = {
    backgroundColor: colors.surfaceBackground,
    borderColor: colors.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.06,
    shadowRadius: 8,
    elevation: 3,
  };

  const impactLines =
    impact && !impactLoadFailed ? buildDeletionImpactLines(impact) : [];
  const showFallbackCopy =
    impactLoadFailed && user
      ? `${t('settings.adminUserManagement.deleteImpactLoadFailed')}\n\n${t(
          'settings.adminUserManagement.deleteMessage',
          { email: user.email }
        )}`
      : null;
  /** Fallback copy already includes “cannot be undone” — avoid duplicate footer line. */
  const showFooterWarning = !showFallbackCopy;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <Pressable
        style={styles.overlay}
        onPress={deleting ? undefined : onClose}
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
              disabled={deleting}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityLabel={t('accessibility.closeModal')}
            >
              <Ionicons name="close" size={24} color={colors.bodyText} />
            </Pressable>

          {isSelf ? (
            <>
              <View style={styles.warningHeader}>
                <View style={[styles.warningIconWrap, { backgroundColor: '#FF950020' }]}>
                  <Ionicons name="warning" size={28} color="#FF9500" />
                </View>
                <Text
                  style={[
                    styles.sheetTitle,
                    { color: colors.bodyText },
                    Platform.OS === 'android' ? { includeFontPadding: false } : null,
                  ]}
                >
                  {t('settings.adminUserManagement.deleteSelfTitle')}
                </Text>
              </View>
              <Text style={[styles.subtitle, { color: colors.labelText }]}>
                {t('settings.adminUserManagement.deleteSelfMessage')}
              </Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={[styles.primaryButtonText, { color: onTint }]}>{t('common.ok')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.deleteHeader}>
                <View style={[styles.deleteIconWrap, { backgroundColor: '#FF3B3020' }]}>
                  <Ionicons name="trash-outline" size={26} color="#FF3B30" />
                </View>
                <View style={styles.deleteHeaderText}>
                  <Text
                    style={[
                      styles.sheetTitle,
                      { color: colors.bodyText },
                      Platform.OS === 'android' ? { includeFontPadding: false } : null,
                    ]}
                  >
                    {t('settings.adminUserManagement.deleteTitle')}
                  </Text>
                  {user ? (
                    <Text style={[styles.subtitle, { color: colors.labelText }]} numberOfLines={2}>
                      {t('settings.adminUserManagement.deleteImpactAccount', { email: user.email })}
                    </Text>
                  ) : null}
                </View>
              </View>

              <ScrollView
                style={[
                  styles.scroll,
                  { maxHeight: Math.min(Sizing.modal.sheetScrollMaxHeight, sheetMaxH * 0.55) },
                ]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator
                bounces
                keyboardShouldPersistTaps="handled"
              >
                {impactLoading ? (
                  <View style={styles.loadingBlock}>
                    <ActivityIndicator size="large" color={colors.tint} />
                    <Text style={[styles.loadingHint, { color: colors.labelText }]}>
                      {t('common.loading')}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.impactCard, cardStyle]}>
                    <View style={[styles.impactBadge, { backgroundColor: '#FF3B30' }]}>
                      <Text style={styles.impactBadgeText}>
                        {t('settings.adminUserManagement.deleteSheetImpactBadge')}
                      </Text>
                    </View>
                    <View style={styles.impactCardInner}>
                      {showFallbackCopy ? (
                        <Text style={[styles.impactLine, { color: colors.bodyText }]}>
                          {showFallbackCopy}
                        </Text>
                      ) : impactLines.length <= 1 ? (
                        <Text style={[styles.impactLine, { color: colors.labelText }]}>
                          {t('settings.adminUserManagement.deleteMessage', {
                            email: user?.email ?? '',
                          })}
                        </Text>
                      ) : (
                        impactLines.slice(1).map((line, i) => (
                          <Text
                            key={`${i}-${line.slice(0, 24)}`}
                            style={[styles.impactLine, { color: colors.bodyText }]}
                          >
                            {line}
                          </Text>
                        ))
                      )}
                    </View>
                  </View>
                )}

                {showFooterWarning ? (
                  <Text style={[styles.footerWarning, { color: colors.labelText }]}>
                    {t('settings.adminUserManagement.deleteImpactFooter')}
                  </Text>
                ) : null}
              </ScrollView>

              {deleteError ? (
                <Text style={styles.errorText}>{deleteError}</Text>
              ) : null}

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={onClose}
                  disabled={deleting}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    {
                      borderColor: colors.surfaceBorder,
                      backgroundColor: colors.surface,
                      opacity: deleting ? 0.5 : pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.bodyText }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmDelete}
                  disabled={deleting || impactLoading}
                  style={({ pressed }) => [
                    styles.destructiveButton,
                    {
                      opacity:
                        deleting || impactLoading ? 0.5 : pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  {deleting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.destructiveButtonText}>{t('common.delete')}</Text>
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
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  /** Matches BroadcastNotificationSheet / SendUserMessageSheet. */
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
  /** Avoid ThemedText `title` (lineHeight 32 / font 32) — it clips mixed font sizes on Android. */
  sheetTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 28,
    paddingTop: Platform.OS === 'android' ? 2 : 0,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Sizing.padding.m,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: Sizing.padding.s,
  },
  warningIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: Sizing.padding.m,
  },
  deleteIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    paddingBottom: Sizing.padding.m,
  },
  loadingBlock: {
    paddingVertical: Sizing.padding.xl,
    alignItems: 'center',
    gap: Sizing.padding.m,
  },
  loadingHint: {
    fontSize: 14,
  },
  impactCard: {
    marginTop: 4,
    marginBottom: Sizing.padding.m,
    padding: Sizing.padding.l,
    paddingTop: Sizing.padding.l + 10,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'visible',
  },
  impactBadge: {
    position: 'absolute',
    top: -8,
    left: 12,
    zIndex: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: '90%',
  },
  impactBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 11,
  },
  impactCardInner: {
    gap: 10,
    paddingTop: Sizing.padding.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  impactLine: {
    fontSize: 14,
    lineHeight: 21,
  },
  footerWarning: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Sizing.padding.s,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: Sizing.padding.s,
    marginBottom: Sizing.padding.s,
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
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  destructiveButton: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  destructiveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  primaryButton: {
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Sizing.padding.m,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
