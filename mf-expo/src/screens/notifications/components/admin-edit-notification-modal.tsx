/**
 * Admin: edit an existing broadcast notification (title, body, links, type, priority).
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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import type { NotificationItem } from '../models/notification-models';

const TYPES: NotificationItem['type'][] = ['info', 'warning', 'success', 'error'];
const PRIORITIES: NonNullable<NotificationItem['priority']>[] = ['high', 'normal', 'low'];

export interface AdminEditNotificationModalProps {
  visible: boolean;
  notification: NotificationItem | null;
  onClose: () => void;
  onSave: (id: string, input: Record<string, string>) => Promise<void>;
}

export function AdminEditNotificationModal({
  visible,
  notification,
  onClose,
  onSave,
}: AdminEditNotificationModalProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const textInputTheme = themedTextInputProps(colors, isDark);
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [type, setType] = useState<NotificationItem['type']>('info');
  const [priority, setPriority] = useState<NonNullable<NotificationItem['priority']>>('normal');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !notification) return;
    setTitle(notification.title);
    setSubtitle(notification.subtitle ?? '');
    setMessage(notification.message);
    setActionUrl(notification.actionUrl ?? '');
    setImageUrl(notification.imageUrl ?? '');
    setType(notification.type);
    setPriority(notification.priority ?? 'normal');
    setErr(null);
  }, [visible, notification]);

  const handleSave = async () => {
    if (!notification?.id) return;
    const tTrim = title.trim();
    const mTrim = message.trim();
    if (!tTrim) {
      setErr(t('settings.broadcast.validation.titleRequired'));
      return;
    }
    if (!mTrim) {
      setErr(t('settings.broadcast.validation.messageRequired'));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave(notification.id, {
        title: tTrim,
        subtitle: subtitle.trim() || '',
        message: mTrim,
        type,
        priority,
        actionUrl: actionUrl.trim() || '',
        imageUrl: imageUrl.trim() || '',
        category: notification.category || 'app',
        icon: notification.icon || 'notifications',
        language: notification.language || 'en',
      });
      onClose();
    } catch (e) {
      setErr(getGraphQLErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!notification) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <AdaptiveKeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.surfaceBorder, paddingTop: Math.max(insets.top, 12) },
          ]}
        >
          <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={12}>
            <Text style={[styles.headerBtnText, { color: colors.tint }]}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.bodyText }]}>
            {t('settings.adminNotificationHistory.editTitle')}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={styles.headerBtn}
            hitSlop={12}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Text style={[styles.headerBtnText, { color: colors.tint, fontWeight: '700' }]}>
                {t('common.save')}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {err ? (
            <View style={[styles.errBox, { backgroundColor: colors.errorColor + '18' }]}>
              <Ionicons name="alert-circle" size={18} color={colors.errorColor} />
              <Text style={[styles.errText, { color: colors.errorColor }]}>{err}</Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.labelText }]}>
            {t('settings.broadcast.titleLabel')}
          </Text>
          <TextInput
            {...textInputTheme}
            value={title}
            onChangeText={setTitle}
            style={[
              styles.input,
              {
                color: colors.bodyText,
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.surfaceBackground,
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
            style={[
              styles.input,
              {
                color: colors.bodyText,
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.surfaceBackground,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.labelText }]}>
            {t('settings.broadcast.messageLabel')}
          </Text>
          <TextInput
            {...textInputTheme}
            value={message}
            onChangeText={setMessage}
            multiline
            style={[
              styles.input,
              styles.inputMultiline,
              {
                color: colors.bodyText,
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.surfaceBackground,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.labelText }]}>
            {t('settings.broadcast.typeLabel')}
          </Text>
          <View style={styles.chips}>
            {TYPES.map((tp) => (
              <Pressable
                key={tp}
                onPress={() => setType(tp)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: type === tp ? colors.tint + '28' : colors.surfaceBackground,
                    borderColor: type === tp ? colors.tint : colors.surfaceBorder,
                  },
                ]}
              >
                <Text style={{ color: colors.bodyText, fontWeight: type === tp ? '600' : '400' }}>
                  {tp}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.labelText }]}>
            {t('settings.broadcast.priorityLabel')}
          </Text>
          <View style={styles.chips}>
            {PRIORITIES.map((pr) => (
              <Pressable
                key={pr}
                onPress={() => setPriority(pr)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: priority === pr ? colors.tint + '28' : colors.surfaceBackground,
                    borderColor: priority === pr ? colors.tint : colors.surfaceBorder,
                  },
                ]}
              >
                <Text style={{ color: colors.bodyText, fontWeight: priority === pr ? '600' : '400' }}>
                  {pr}
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
            style={[
              styles.input,
              {
                color: colors.bodyText,
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.surfaceBackground,
              },
            ]}
            placeholder={t('settings.broadcast.actionUrlPlaceholder')}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: colors.labelText }]}>
            {t('settings.broadcast.imageUrlLabel')}
          </Text>
          <TextInput
            {...textInputTheme}
            value={imageUrl}
            onChangeText={setImageUrl}
            style={[
              styles.input,
              {
                color: colors.bodyText,
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.surfaceBackground,
              },
            ]}
            placeholder={t('settings.broadcast.imageUrlPlaceholder')}
            autoCapitalize="none"
          />
        </ScrollView>
      </AdaptiveKeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 72, paddingVertical: 8, alignItems: 'center' },
  headerBtnText: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Sizing.padding.l, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  errText: { flex: 1, fontSize: 14 },
});
