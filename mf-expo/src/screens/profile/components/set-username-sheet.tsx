/**
 * Bottom sheet to collect nickname when user has none.
 * Non-dismissible — user must complete to proceed.
 * Debounces 2.5s then checks availability; button enabled only when available.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { t } from '@/src/shared/i18n';
import { mfGoUser } from '@/src/shared/services/mf-go-api';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const NICKNAME_MIN = 1;
const NICKNAME_MAX = 80;
const DEBOUNCE_MS = 2500;
const AVAILABILITY_TIMEOUT_MS = 8000;

interface SetUsernameSheetProps {
  visible: boolean;
  onComplete: (nickname: string) => Promise<string | null>;
}

export function SetUsernameSheet({
  visible,
  onComplete,
}: SetUsernameSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const textInputTheme = themedTextInputProps(colors, isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();

  const [nickname, setNickname] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checkError, setCheckError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setNickname('');
      setValidationError(null);
      setSubmitError(null);
      setIsAvailable(null);
      setCheckError(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    }
  }, [visible]);

  const checkAvailability = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < NICKNAME_MIN || trimmed.length > NICKNAME_MAX) {
      setIsAvailable(null);
      setIsChecking(false);
      setCheckError(false);
      return;
    }
    setIsChecking(true);
    setIsAvailable(null);
    setCheckError(false);
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), AVAILABILITY_TIMEOUT_MS)
      );
      const available = await Promise.race([
        mfGoUser.nicknameAvailable(trimmed),
        timeoutPromise,
      ]);
      setIsAvailable(available);
    } catch {
      setCheckError(true);
      setIsAvailable(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = nickname.trim();
    if (trimmed.length < NICKNAME_MIN || trimmed.length > NICKNAME_MAX) {
      setIsAvailable(null);
      setIsChecking(false);
      setCheckError(false);
      return;
    }
    setIsAvailable(null);
    setCheckError(false);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      checkAvailability(nickname);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nickname, checkAvailability]);

  const handleComplete = async () => {
    setValidationError(null);
    setSubmitError(null);
    const trimmed = nickname.trim();
    if (trimmed.length < NICKNAME_MIN) {
      setValidationError(t('profile.setNickname.validation.required'));
      return;
    }
    if (trimmed.length > NICKNAME_MAX) {
      setValidationError(t('profile.setNickname.validation.max', { max: NICKNAME_MAX }));
      return;
    }
    setIsSaving(true);
    try {
      const apiError = await onComplete(trimmed);
      if (apiError) {
        setSubmitError(apiError);
      }
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
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
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
            <Text style={[styles.title, { color: colors.bodyText }]}>
              {t('profile.setNickname.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('profile.setNickname.subtitle')}
            </Text>

            <Text style={[styles.label, { color: colors.labelText }]}>
              {t('profile.setNickname.nicknameLabel')} *
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                {...textInputTheme}
                value={nickname}
                onChangeText={setNickname}
                placeholder={t('profile.setNickname.nicknamePlaceholder')}
                maxLength={NICKNAME_MAX}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                editable={!isSaving}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                    color: colors.bodyText,
                    paddingRight: isChecking ? 44 : 16,
                  },
                ]}
              />
              {isChecking && (
                <View style={styles.inputSuffix}>
                  <ActivityIndicator size="small" color={colors.labelText} />
                </View>
              )}
            </View>
            {nickname.length > 0 && (
              <Text style={[styles.hint, { color: colors.labelText }]}>
                {nickname.length}/{NICKNAME_MAX}
              </Text>
            )}

            {!isChecking && isAvailable === false && (
              <Text style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}>
                {t('profile.setNickname.taken')}
              </Text>
            )}
            {!isChecking && checkError && (
              <Text style={[styles.hint, { color: colors.labelText }]}>
                {t('profile.setNickname.checkFailed')}
              </Text>
            )}

            {(validationError || submitError) && (
              <Text style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}>
                {validationError || submitError}
              </Text>
            )}

            {(() => {
              const trimmed = nickname.trim();
              const canSubmit =
                !isSaving &&
                !isChecking &&
                trimmed.length >= NICKNAME_MIN &&
                trimmed.length <= NICKNAME_MAX &&
                (isAvailable === true || checkError);
              return (
                <Pressable
                  onPress={handleComplete}
                  disabled={!canSubmit}
                  style={({ pressed }) => [
                    styles.completeButton,
                    {
                      backgroundColor: colors.tint,
                      opacity: !canSubmit ? 0.5 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator color={onTint} />
                  ) : (
                    <Text style={[styles.completeButtonText, { color: onTint }]}>
                      {t('profile.setNickname.complete')}
                    </Text>
                  )}
                </Pressable>
              );
            })()}
          </Pressable>
        </AdaptiveKeyboardAvoidingView>
      </View>
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
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 17,
  },
  inputSuffix: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 12,
  },
  completeButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  completeButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
