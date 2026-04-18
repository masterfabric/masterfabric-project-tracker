/**
 * Bottom sheet: org chat message details + owner-only delete (confirm step in same Modal — stacked Modals fail on iOS).
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { t } from '@/src/shared/i18n';
import {
  mfGoOrganizations,
  type OrganizationMessagePayload,
} from '@/src/shared/services/mf-go-api';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useState } from 'react';
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

type SheetMessage = OrganizationMessagePayload & { _sendState?: 'sending' | 'failed' };

export interface OrgMessageDetailSheetProps {
  visible: boolean;
  message: SheetMessage | null;
  organizationId: string;
  /** Current user is organization owner (can delete any persisted message). */
  isOrgOwner: boolean;
  locale: string;
  onClose: () => void;
  /** Called after server confirms delete; remove from list + seenIds in parent. */
  onDeleted: (messageId: string) => void;
}

function formatFullTimestamp(iso: string, localeTag: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(localeTag.replace('_', '-'), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function previewBody(body: string, maxLen = 280): string {
  const trimmed = body.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

export function OrgMessageDetailSheet({
  visible,
  message,
  organizationId,
  isOrgOwner,
  locale,
  onClose,
  onDeleted,
}: OrgMessageDetailSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const sheetMaxH = Math.round(
    Math.min(winH * Sizing.modal.sheetMaxHeightFraction, winH - Math.max(insets.top, 8))
  );

  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setDeleteConfirmVisible(false);
      setDeleteError(null);
    }
  }, [visible]);

  const runDelete = useCallback(async () => {
    if (!message || !isOrgOwner) return;
    if (message.id.startsWith('local-') || message._sendState === 'sending') return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await mfGoOrganizations.deleteOrganizationMessage(organizationId, message.id);
      setDeleteConfirmVisible(false);
      onDeleted(message.id);
      onClose();
    } catch {
      setDeleteError(t('tabs.orgMessages.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }, [message, isOrgOwner, organizationId, onDeleted, onClose]);

  const cardStyle = {
    backgroundColor: colors.surfaceBackground,
    borderColor: colors.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.06,
    shadowRadius: 8,
    elevation: 3,
  };

  const senderLabel =
    message?.authorNickname?.trim() || (message ? `@${message.authorUserID.slice(0, 8)}…` : '');

  const isLocal = !!message && message.id.startsWith('local-');
  const isSending = !!message && message._sendState === 'sending';
  const canDelete = !!message && isOrgOwner && !isLocal && !isSending;

  const dismissOverlay = () => {
    if (deleteConfirmVisible) {
      if (!deleting) setDeleteConfirmVisible(false);
    } else {
      onClose();
    }
  };

  const dismissHeaderClose = () => {
    if (deleteConfirmVisible) {
      if (!deleting) setDeleteConfirmVisible(false);
    } else {
      onClose();
    }
  };

  if (!visible || !message) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={dismissOverlay}
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape-left',
        'landscape-right',
      ]}
    >
      <Pressable
        style={styles.overlay}
        onPress={dismissOverlay}
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
              onPress={dismissHeaderClose}
              disabled={deleting}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityLabel={t('accessibility.closeModal')}
            >
              <Ionicons name="close" size={24} color={colors.bodyText} />
            </Pressable>

            {!deleteConfirmVisible ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={[styles.detailIconWrap, { backgroundColor: colors.tint + '22' }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.tint} />
                  </View>
                  <Text
                    style={[
                      styles.sheetTitle,
                      { color: colors.bodyText },
                      Platform.OS === 'android' ? { includeFontPadding: false } : null,
                    ]}
                  >
                    {t('tabs.orgMessages.detailTitle')}
                  </Text>
                </View>

                <ScrollView
                  style={[
                    styles.scroll,
                    { maxHeight: Math.min(Sizing.modal.sheetScrollMaxHeight, sheetMaxH * 0.58) },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  <View style={[styles.infoCard, cardStyle]}>
                    <View style={styles.infoCardInner}>
                      <Text style={[styles.label, { color: colors.labelText }]}>
                        {t('tabs.orgMessages.detailSender')}
                      </Text>
                      <Text style={[styles.value, { color: colors.bodyText }]}>{senderLabel}</Text>

                      <Text style={[styles.label, { color: colors.labelText }]}>
                        {t('tabs.orgMessages.detailUserId')}
                      </Text>
                      <Text style={[styles.mono, { color: colors.bodyText }]} selectable>
                        {message.authorUserID}
                      </Text>

                      <Text style={[styles.label, { color: colors.labelText }]}>
                        {t('tabs.orgMessages.detailSentAt')}
                      </Text>
                      <Text style={[styles.value, { color: colors.bodyText }]}>
                        {formatFullTimestamp(message.createdAt, locale)}
                      </Text>

                      <Text style={[styles.label, { color: colors.labelText }]}>
                        {t('tabs.orgMessages.detailMessage')}
                      </Text>
                      <Text style={[styles.bodyPreview, { color: colors.bodyText }]} selectable>
                        {message.body}
                      </Text>
                    </View>
                  </View>

                  {isSending ? (
                    <Text style={[styles.hint, { color: colors.labelText }]}>
                      {t('tabs.orgMessages.detailPendingHint')}
                    </Text>
                  ) : null}
                  {isLocal && !isSending ? (
                    <Text style={[styles.hint, { color: colors.labelText }]}>
                      {t('tabs.orgMessages.detailLocalHint')}
                    </Text>
                  ) : null}
                </ScrollView>

                {canDelete ? (
                  <Pressable
                    onPress={() => {
                      setDeleteError(null);
                      setDeleteConfirmVisible(true);
                    }}
                    style={({ pressed }) => [
                      styles.deleteOutlineBtn,
                      {
                        borderColor: colors.errorColor || '#FF3B30',
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.errorColor || '#FF3B30'} />
                    <Text style={[styles.deleteOutlineBtnText, { color: colors.errorColor || '#FF3B30' }]}>
                      {t('tabs.orgMessages.deleteAction')}
                    </Text>
                  </Pressable>
                ) : null}
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
                      {t('tabs.orgMessages.deleteConfirmTitle')}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.labelText }]} numberOfLines={2}>
                      {t('tabs.orgMessages.deleteSheetFrom', { name: senderLabel })}
                    </Text>
                  </View>
                </View>

                <ScrollView
                  style={[
                    styles.scroll,
                    { maxHeight: Math.min(Sizing.modal.sheetScrollMaxHeight, sheetMaxH * 0.42) },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  <View style={[styles.deletePreviewCard, cardStyle]}>
                    <Text style={[styles.deletePreviewText, { color: colors.bodyText }]}>
                      {previewBody(message.body)}
                    </Text>
                  </View>

                  <Text style={[styles.footerWarning, { color: colors.labelText }]}>
                    {t('tabs.orgMessages.deleteConfirmBody')}
                  </Text>

                  {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
                </ScrollView>

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => setDeleteConfirmVisible(false)}
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
                    onPress={() => void runDelete()}
                    disabled={deleting}
                    style={({ pressed }) => [
                      styles.destructiveButton,
                      { opacity: deleting ? 0.5 : pressed ? 0.88 : 1 },
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
    marginTop: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: Sizing.padding.m,
  },
  detailIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    width: '100%',
  },
  infoCard: {
    marginTop: 4,
    marginBottom: Sizing.padding.s,
    padding: Sizing.padding.l,
    paddingTop: Sizing.padding.m,
    borderRadius: 16,
    borderWidth: 1,
  },
  infoCardInner: {
    gap: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  value: { fontSize: 16 },
  mono: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  bodyPreview: { fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 13, marginTop: 12, fontStyle: 'italic' },
  deleteOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Sizing.padding.m,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteOutlineBtnText: { fontSize: 17, fontWeight: '600' },
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
  deletePreviewCard: {
    marginTop: 4,
    marginBottom: Sizing.padding.m,
    padding: Sizing.padding.l,
    borderRadius: 16,
    borderWidth: 1,
  },
  deletePreviewText: {
    fontSize: 15,
    lineHeight: 22,
  },
  footerWarning: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Sizing.padding.s,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
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
    minHeight: 52,
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
});
