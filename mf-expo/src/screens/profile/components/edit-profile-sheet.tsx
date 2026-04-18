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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UserProfile } from '@/src/shared/services/mf-go-api';
import type { UpdateProfileFields } from '../hooks/use-profile-view-model';

const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 80;
const NICKNAME_MAX = 80;
const BIO_MAX = 500;

function isValidUrl(s: string): boolean {
  if (!s.trim()) return true;
  try {
    new URL(s.trim());
    return true;
  } catch {
    return false;
  }
}

function validate(
  displayName: string,
  nickname: string,
  bio: string,
  websiteURL: string,
  avatarURL: string
): string | null {
  const dn = displayName.trim();
  if (dn.length < DISPLAY_NAME_MIN) {
    return t('profile.edit.validation.displayNameRequired');
  }
  if (dn.length > DISPLAY_NAME_MAX) {
    return t('profile.edit.validation.displayNameMax', { max: DISPLAY_NAME_MAX });
  }
  if (nickname.length > NICKNAME_MAX) {
    return t('profile.edit.validation.nicknameMax', { max: NICKNAME_MAX });
  }
  if (bio.length > BIO_MAX) {
    return t('profile.edit.validation.bioMax', { max: BIO_MAX });
  }
  if (!isValidUrl(websiteURL)) {
    return t('profile.edit.validation.invalidUrl');
  }
  if (!isValidUrl(avatarURL)) {
    return t('profile.edit.validation.invalidAvatarUrl');
  }
  return null;
}

interface EditProfileSheetProps {
  visible: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onSave: (input: UpdateProfileFields) => Promise<string | null>;
}

export function EditProfileSheet({
  visible,
  profile,
  onClose,
  onSave,
}: EditProfileSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [websiteURL, setWebsiteURL] = useState('');
  const [avatarURL, setAvatarURL] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile && visible) {
      setDisplayName(profile.displayName || '');
      setNickname(profile.nickname || '');
      setBio(profile.bio || '');
      setPhoneNumber(profile.phoneNumber || '');
      setLocation(profile.location || '');
      setWebsiteURL(profile.websiteURL || '');
      setAvatarURL(profile.avatarURL || '');
      setValidationError(null);
      setSubmitError(null);
    }
  }, [profile, visible]);

  const handleSave = async () => {
    setValidationError(null);
    setSubmitError(null);
    const err = validate(displayName, nickname, bio, websiteURL, avatarURL);
    if (err) {
      setValidationError(err);
      return;
    }
    setIsSaving(true);
    try {
      const apiError = await onSave({
        displayName: displayName.trim(),
        nickname: nickname.trim() || undefined,
        bio: bio.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        location: location.trim() || undefined,
        websiteURL: websiteURL.trim() || undefined,
        avatarURL: avatarURL.trim() || undefined,
      });
      if (apiError) {
        setSubmitError(apiError);
      } else {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    profile &&
    (displayName.trim() !== (profile.displayName || '') ||
      nickname.trim() !== (profile.nickname || '') ||
      bio.trim() !== (profile.bio || '') ||
      phoneNumber.trim() !== (profile.phoneNumber || '') ||
      location.trim() !== (profile.location || '') ||
      websiteURL.trim() !== (profile.websiteURL || '') ||
      avatarURL.trim() !== (profile.avatarURL || ''));

  const canSave = hasChanges && displayName.trim().length >= DISPLAY_NAME_MIN;

  if (!visible) return null;

  const textInputTheme = themedTextInputProps(colors, isDark);
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surfaceBackground,
      borderColor: colors.surfaceBorder,
      color: colors.bodyText,
    },
  ];

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
                paddingBottom: insets.bottom,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />
            <Text style={[styles.title, { color: colors.bodyText }]}>
              {t('profile.edit.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('profile.edit.subtitle')}
            </Text>

            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.edit.displayName')} *
              </Text>
              <TextInput
                {...textInputTheme}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={t('profile.edit.displayNamePlaceholder')}
                maxLength={DISPLAY_NAME_MAX}
                autoCapitalize="words"
                style={inputStyle}
              />
              {displayName.length > 0 && (
                <Text style={[styles.hint, { color: colors.labelText }]}>
                  {displayName.length}/{DISPLAY_NAME_MAX}
                </Text>
              )}

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.edit.nickname')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={nickname}
                onChangeText={setNickname}
                placeholder={t('profile.setNickname.nicknamePlaceholder')}
                maxLength={NICKNAME_MAX}
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
              {nickname.length > 0 && (
                <Text style={[styles.hint, { color: colors.labelText }]}>
                  {nickname.length}/{NICKNAME_MAX}
                </Text>
              )}

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.edit.bio')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={bio}
                onChangeText={setBio}
                placeholder={t('profile.edit.bioPlaceholder')}
                maxLength={BIO_MAX}
                multiline
                numberOfLines={3}
                style={[inputStyle, styles.textArea]}
              />
              {bio.length > 0 && (
                <Text style={[styles.hint, { color: colors.labelText }]}>
                  {bio.length}/{BIO_MAX}
                </Text>
              )}

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.edit.phoneNumber')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder={t('profile.edit.phoneNumberPlaceholder')}
                keyboardType="phone-pad"
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.edit.location')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={location}
                onChangeText={setLocation}
                placeholder={t('profile.edit.locationPlaceholder')}
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.edit.websiteURL')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={websiteURL}
                onChangeText={setWebsiteURL}
                placeholder={t('profile.edit.websiteURLPlaceholder')}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.edit.avatarURL')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={avatarURL}
                onChangeText={setAvatarURL}
                placeholder={t('profile.edit.avatarURLPlaceholder')}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
            </ScrollView>

            {(validationError || submitError) && (
              <Text
                style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}
              >
                {validationError || submitError}
              </Text>
            )}

            <Text style={[styles.actionsHint, { color: colors.labelText }]}>
              {t('profile.edit.actionsHint')}
            </Text>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={onClose}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.cancelButton,
                  {
                    backgroundColor: colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.bodyText }]}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!canSave || isSaving}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: canSave && !isSaving ? colors.tint : colors.surfaceBorder,
                    opacity: pressed ? 0.9 : 1,
                  },
                  (!canSave || isSaving) && styles.saveButtonDisabled,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.tint} />
                ) : (
                  <Text
                    style={[
                      styles.saveButtonText,
                      {
                        color: canSave && !isSaving ? onTint : colors.labelText,
                      },
                    ]}
                  >
                    {t('profile.edit.save')}
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
    height: '90%',
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
    fontWeight: '700',
    marginBottom: Sizing.gap.s,
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.85,
    marginBottom: Sizing.padding.l,
  },
  scroll: {
    flex: 1,
    marginBottom: Sizing.padding.s,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Sizing.padding.m,
    paddingVertical: Sizing.padding.m,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    marginBottom: Sizing.padding.m,
  },
  actionsHint: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
    marginBottom: Sizing.padding.m,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
