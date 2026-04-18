/**
 * Admin-only sheet to send a user-specific message (snackbar).
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoAdmin, mfGoUserMessages } from '@/src/shared/services';
import type { AdminUserProfile } from '@/src/shared/services/mf-go-api';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SendUserMessageSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MESSAGE_TYPES = ['info', 'success', 'warning', 'error'] as const;

export function SendUserMessageSheet({
  visible,
  onClose,
  onSuccess,
}: SendUserMessageSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const textInputTheme = themedTextInputProps(colors, isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(null);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<(typeof MESSAGE_TYPES)[number]>('info');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await mfGoAdmin.users(1, 100);
      setUsers(res.users);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadUsers();
      setSelectedUser(null);
      setMessage('');
      setType('info');
      setError(null);
    }
  }, [visible, loadUsers]);

  const handleSend = async () => {
    setError(null);
    if (!selectedUser) {
      setError(t('settings.sendUserMessage.validation.userRequired'));
      return;
    }
    const tMessage = message.trim();
    if (!tMessage) {
      setError(t('settings.sendUserMessage.validation.messageRequired'));
      return;
    }
    setIsSaving(true);
    try {
      await mfGoUserMessages.adminCreate({
        userID: selectedUser.id,
        message: tMessage,
        type,
      });
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
            >
              <Ionicons name="close" size={24} color={colors.bodyText} />
            </Pressable>
            <Text style={[styles.title, { color: colors.bodyText }]}>
              {t('settings.sendUserMessage.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('settings.sendUserMessage.subtitle')}
            </Text>

            <Text style={[styles.label, { color: colors.labelText }]}>
              {t('settings.sendUserMessage.selectUser')} *
            </Text>
            {usersLoading ? (
              <ActivityIndicator size="small" color={colors.tint} style={styles.loader} />
            ) : (
              <View style={[styles.userList, { backgroundColor: colors.surfaceBackground, borderColor: colors.surfaceBorder }]}>
                <FlatList
                  data={users}
                  keyExtractor={(u) => u.id}
                  style={styles.userListInner}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => setSelectedUser(item)}
                      style={[
                        styles.userRow,
                        {
                          backgroundColor: selectedUser?.id === item.id ? colors.tint + '20' : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[styles.userEmail, { color: colors.bodyText }]} numberOfLines={1}>
                        {item.email}
                      </Text>
                      <Text style={[styles.userName, { color: colors.labelText }]} numberOfLines={1}>
                        {item.displayName || '—'}
                      </Text>
                      {selectedUser?.id === item.id && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.tint} />
                      )}
                    </Pressable>
                  )}
                />
              </View>
            )}

            <Text style={[styles.label, { color: colors.labelText, marginTop: 16 }]}>
              {t('settings.sendUserMessage.messageLabel')} *
            </Text>
            <TextInput
              {...textInputTheme}
              value={message}
              onChangeText={setMessage}
              placeholder={t('settings.sendUserMessage.messagePlaceholder')}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.inputMultiline,
                {
                  backgroundColor: colors.surfaceBackground,
                  borderColor: colors.surfaceBorder,
                  color: colors.bodyText,
                },
              ]}
            />

            <Text style={[styles.label, { color: colors.labelText, marginTop: 16 }]}>
              {t('settings.sendUserMessage.typeLabel')}
            </Text>
            <View style={styles.typeRow}>
              {MESSAGE_TYPES.map((tipo) => (
                <Pressable
                  key={tipo}
                  onPress={() => setType(tipo)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: type === tipo ? colors.tint : colors.surfaceBackground,
                      borderColor: colors.surfaceBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: type === tipo ? onTint : colors.bodyText },
                    ]}
                  >
                    {tipo}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error && (
              <Text style={[styles.error, { color: colors.errorColor || '#FF3B30' }]}>
                {error}
              </Text>
            )}

            <Pressable
              onPress={handleSend}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: colors.tint,
                  opacity: isSaving ? 0.6 : pressed ? 0.9 : 1,
                },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={[styles.sendButtonText, { color: onTint }]}>
                  {t('settings.sendUserMessage.send')}
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
    maxHeight: '85%',
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
    top: Sizing.padding.m,
    right: Sizing.padding.xl,
  },
  title: { fontSize: 19, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: Sizing.padding.l, opacity: 0.85 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  loader: { marginVertical: 16 },
  userList: {
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: 160,
  },
  userListInner: { maxHeight: 156 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  userEmail: { flex: 1, fontSize: 15 },
  userName: { flex: 1, fontSize: 13, opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 14, fontWeight: '500' },
  error: { marginTop: 12, fontSize: 14 },
  sendButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendButtonText: { fontSize: 17, fontWeight: '600' },
});
