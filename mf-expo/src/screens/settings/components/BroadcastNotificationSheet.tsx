/**
 * Admin-only sheet to broadcast a notification to all users.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { notificationService } from '@/src/screens/notifications/services/notification-service';
import { useNotificationStore } from '@/src/screens/notifications/store/notification-store';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BroadcastNotificationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BroadcastNotificationSheet({
  visible,
  onClose,
  onSuccess,
}: BroadcastNotificationSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const textInputTheme = themedTextInputProps(colors, isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [actionUrl, setActionUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setSubtitle('');
      setMessage('');
      setType('info');
      setPriority('normal');
      setActionUrl('');
      setImageUrl('');
      setError(null);
    }
  }, [visible]);

  const handleSend = async () => {
    setError(null);
    const tTitle = title.trim();
    const tMessage = message.trim();
    if (!tTitle) {
      setError(t('settings.broadcast.validation.titleRequired'));
      return;
    }
    if (!tMessage) {
      setError(t('settings.broadcast.validation.messageRequired'));
      return;
    }
    setIsSaving(true);
    try {
      await notificationService.adminCreate({
        title: tTitle,
        subtitle: subtitle.trim() || undefined,
        message: tMessage,
        type,
        category: 'app',
        priority,
        actionUrl: actionUrl.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
      useNotificationStore.getState().requestRefresh();
      onClose();
      onSuccess?.();
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

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
              disabled={isSaving}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityLabel={t('accessibility.closeModal')}
            >
              <Ionicons name="close" size={24} color={colors.bodyText} />
            </Pressable>
            <Text style={[styles.title, { color: colors.bodyText }]}>
              {t('settings.broadcast.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('settings.broadcast.subtitle')}
            </Text>

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('settings.broadcast.titleLabel')} *
              </Text>
              <TextInput
                {...textInputTheme}
                value={title}
                onChangeText={setTitle}
                placeholder={t('settings.broadcast.titlePlaceholder')}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                    color: colors.bodyText,
                  },
                ]}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('settings.broadcast.subtitleLabel')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={subtitle}
                onChangeText={setSubtitle}
                placeholder={t('settings.broadcast.subtitlePlaceholder')}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                    color: colors.bodyText,
                  },
                ]}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('settings.broadcast.messageLabel')} *
              </Text>
              <TextInput
                {...textInputTheme}
                value={message}
                onChangeText={setMessage}
                placeholder={t('settings.broadcast.messagePlaceholder')}
                multiline
                numberOfLines={3}
                style={[
                  styles.input,
                  styles.messageInput,
                  {
                    backgroundColor: colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                    color: colors.bodyText,
                  },
                ]}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('settings.broadcast.typeLabel')}
              </Text>
              <View style={styles.chipRow}>
                {(['info', 'warning', 'success', 'error'] as const).map((tpe) => (
                  <Pressable
                    key={tpe}
                    onPress={() => setType(tpe)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: type === tpe ? colors.tint + '30' : colors.surfaceBackground,
                        borderColor: colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text style={{ color: type === tpe ? colors.tint : colors.bodyText, fontSize: 13 }}>
                      {tpe}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('settings.broadcast.priorityLabel')}
              </Text>
              <View style={styles.chipRow}>
                {(['high', 'normal', 'low'] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: priority === p ? colors.tint + '30' : colors.surfaceBackground,
                        borderColor: colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text style={{ color: priority === p ? colors.tint : colors.bodyText, fontSize: 13 }}>
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('settings.broadcast.actionUrlLabel')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={actionUrl}
                onChangeText={setActionUrl}
                placeholder={t('settings.broadcast.actionUrlPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                    color: colors.bodyText,
                  },
                ]}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('settings.broadcast.imageUrlLabel')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder={t('settings.broadcast.imageUrlPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                    color: colors.bodyText,
                  },
                ]}
              />
            </ScrollView>

            {error && (
              <Text style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}>
                {error}
              </Text>
            )}

            <Pressable
              onPress={handleSend}
              disabled={isSaving || !title.trim() || !message.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: colors.tint,
                  opacity: isSaving || !title.trim() || !message.trim() ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={[styles.sendButtonText, { color: onTint }]}>
                  {t('settings.broadcast.send')}
                </Text>
              )}
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
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    paddingHorizontal: Sizing.padding.l,
    paddingTop: Sizing.padding.s,
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
    marginBottom: Sizing.padding.m,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Sizing.padding.m,
  },
  scroll: {
    maxHeight: Sizing.modal.sheetBroadcastScrollMaxHeight,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Sizing.padding.m,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: Sizing.padding.m,
  },
  messageInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 13,
    marginBottom: Sizing.padding.s,
  },
  sendButton: {
    paddingVertical: Sizing.padding.m,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: Sizing.padding.s,
  },
  sendButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
