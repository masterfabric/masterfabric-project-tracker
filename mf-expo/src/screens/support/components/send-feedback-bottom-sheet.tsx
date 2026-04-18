/**
 * Bottom sheet: submit feedback to mf-go (signed-in or guest with email).
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { MessageBottomSheet, okSheetAction } from '@/src/shared/components/MessageBottomSheet';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoFeedback } from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Sizing, useTheme, useThemeColors } from 'masterfabric-expo-core';

function isPlausibleContactEmail(s: string): boolean {
  const x = s.trim().toLowerCase();
  if (x.length < 5 || x.length > 254) return false;
  const at = x.lastIndexOf('@');
  if (at <= 0 || at >= x.length - 1) return false;
  return x.slice(at + 1).includes('.');
}

export interface SendFeedbackBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after successful submit */
  onSubmitted?: () => void;
}

export function SendFeedbackBottomSheet({
  visible,
  onClose,
  onSubmitted,
}: SendFeedbackBottomSheetProps) {
  const { isDark } = useTheme();
  const colors = useThemeColors();
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  const [subject, setSubject] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestThanksVisible, setGuestThanksVisible] = useState(false);

  const reset = useCallback(() => {
    setSubject('');
    setContactEmail('');
    setMessage('');
    setError(null);
    setSending(false);
    setGuestThanksVisible(false);
  }, []);

  const handleClose = useCallback(() => {
    if (sending) return;
    reset();
    onClose();
  }, [sending, onClose, reset]);

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError(t('support.feedback.validationMessage'));
      return;
    }
    if (!isAuthenticated) {
      const email = contactEmail.trim();
      if (!email) {
        setError(t('support.feedback.validationEmail'));
        return;
      }
      if (!isPlausibleContactEmail(email)) {
        setError(t('support.feedback.validationEmailFormat'));
        return;
      }
    }
    setError(null);
    setSending(true);
    try {
      const sub = subject.trim();
      const email = contactEmail.trim();
      await mfGoFeedback.submit({
        message: trimmed,
        ...(sub ? { subject: sub } : {}),
        ...(isAuthenticated ? {} : { contactEmail: email }),
      });
      reset();
      onClose();
      if (isAuthenticated) {
        onSubmitted?.();
      } else {
        setGuestThanksVisible(true);
      }
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
    } finally {
      setSending(false);
    }
  }, [
    message,
    subject,
    contactEmail,
    isAuthenticated,
    onClose,
    onSubmitted,
    reset,
  ]);

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
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
          <View style={[styles.handle, { backgroundColor: colors.divider }]} />
          <View style={styles.titleRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.tint} />
            <Text style={[styles.title, { color: colors.bodyText }]}>
              {t('support.feedback.sheetTitle')}
            </Text>
          </View>
          <Text style={[styles.hint, { color: colors.labelText }]}>
            {isAuthenticated ? t('support.feedback.sheetHint') : t('support.feedback.sheetHintGuest')}
          </Text>

          {!isAuthenticated ? (
            <>
              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('support.feedback.emailLabel')}
              </Text>
              <TextInput
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder={t('support.feedback.emailPlaceholder')}
                placeholderTextColor={colors.labelText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  {
                    color: colors.bodyText,
                    borderColor: colors.surfaceBorder,
                    backgroundColor: colors.surfaceBackground,
                  },
                ]}
                editable={!sending}
                maxLength={254}
              />
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.labelText }]}>
            {t('support.feedback.subjectOptional')}
          </Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder={t('support.feedback.subjectPlaceholder')}
            placeholderTextColor={colors.labelText}
            style={[
              styles.input,
              {
                color: colors.bodyText,
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.surfaceBackground,
              },
            ]}
            editable={!sending}
            maxLength={200}
          />

          <Text style={[styles.label, { color: colors.labelText }]}>
            {t('support.feedback.messageLabel')}
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t('support.feedback.messagePlaceholder')}
            placeholderTextColor={colors.labelText}
            style={[
              styles.input,
              styles.multiline,
              {
                color: colors.bodyText,
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.surfaceBackground,
              },
            ]}
            multiline
            textAlignVertical="top"
            editable={!sending}
            maxLength={8000}
          />

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleClose}
              disabled={sending}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  borderColor: colors.surfaceBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.bodyText }]}>
                {t('support.feedback.cancel')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSubmit()}
              disabled={sending}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.tint, opacity: pressed ? 0.92 : 1 },
              ]}
            >
              {sending ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: onTint }]}>
                  {t('support.feedback.send')}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
        </AdaptiveKeyboardAvoidingView>
      </Pressable>
    </Modal>
    <MessageBottomSheet
      visible={guestThanksVisible}
      onDismiss={() => setGuestThanksVisible(false)}
      title={t('support.feedback.sentTitle')}
      message={t('support.feedback.sentGuestBody')}
      variant="success"
      primaryAction={okSheetAction(() => setGuestThanksVisible(false))}
    />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '600', flex: 1 },
  hint: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  label: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 14,
  },
  multiline: { minHeight: 120 },
  error: { color: '#FF3B30', marginBottom: 12, fontSize: 14 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
});
