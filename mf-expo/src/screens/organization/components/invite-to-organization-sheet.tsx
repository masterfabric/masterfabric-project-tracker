/**
 * Bottom sheet to invite a user to an organization by email.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { t } from '@/src/shared/i18n';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface InviteToOrganizationSheetProps {
  visible: boolean;
  organizationName: string;
  onClose: () => void;
  onInvite: (email: string) => Promise<string | null>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteToOrganizationSheet({
  visible,
  organizationName,
  onClose,
  onInvite,
}: InviteToOrganizationSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail('');
      setValidationError(null);
      setSubmitError(null);
    }
  }, [visible]);

  const handleInvite = async () => {
    setValidationError(null);
    setSubmitError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setValidationError(t('profile.organizations.invite.validation.emailRequired'));
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setValidationError(t('profile.organizations.invite.validation.emailInvalid'));
      return;
    }
    setIsSaving(true);
    try {
      const apiError = await onInvite(trimmed);
      if (apiError) {
        setSubmitError(apiError);
      } else {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  const textInputTheme = themedTextInputProps(colors, isDark);

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
              {t('profile.organizations.invite.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('profile.organizations.invite.subtitle', { name: organizationName })}
            </Text>

            <Text style={[styles.label, { color: colors.labelText }]}>
              {t('profile.organizations.invite.emailLabel')} *
            </Text>
            <TextInput
              {...textInputTheme}
              value={email}
              onChangeText={setEmail}
              placeholder={t('profile.organizations.invite.emailPlaceholder')}
              keyboardType="email-address"
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

            {(validationError || submitError) && (
              <Text style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}>
                {validationError || submitError}
              </Text>
            )}

            <Pressable
              onPress={handleInvite}
              disabled={isSaving || !email.trim()}
              style={({ pressed }) => [
                styles.inviteButton,
                {
                  backgroundColor: colors.tint,
                  opacity: isSaving || !email.trim() ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={onTint} />
              ) : (
                <Text style={[styles.inviteButtonText, { color: onTint }]}>
                  {t('profile.organizations.invite.send')}
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
  title: {
    fontSize: 19,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 17,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 12,
  },
  inviteButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  inviteButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
