import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { t } from '@/src/shared/i18n';
import type { UpsertAddressInput, UserAddress } from '@/src/shared/services/mf-go-api';
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmationBottomSheetOverlay } from './confirmation-bottom-sheet';

const TITLE_MAX = 100;
const LINE_MAX = 255;
const CITY_MAX = 100;
const STATE_MAX = 100;
const POSTAL_MAX = 20;
const COUNTRY_MAX = 100;

function validate(
  title: string,
  line1: string,
  line2: string,
  city: string,
  state: string,
  postal: string,
  country: string
): string | null {
  if (title.length > TITLE_MAX) {
    return t('profile.addresses.validation.titleMax', { max: TITLE_MAX });
  }
  if (line1.length > LINE_MAX || line2.length > LINE_MAX) {
    return t('profile.addresses.validation.lineMax', { max: LINE_MAX });
  }
  if (city.length > CITY_MAX) {
    return t('profile.addresses.validation.cityMax', { max: CITY_MAX });
  }
  if (state.length > STATE_MAX) {
    return t('profile.addresses.validation.stateMax', { max: STATE_MAX });
  }
  if (postal.length > POSTAL_MAX) {
    return t('profile.addresses.validation.postalMax', { max: POSTAL_MAX });
  }
  if (country.length > COUNTRY_MAX) {
    return t('profile.addresses.validation.countryMax', { max: COUNTRY_MAX });
  }
  return null;
}

interface ManageAddressSheetProps {
  visible: boolean;
  address: UserAddress | null;
  onClose: () => void;
  onSave: (input: UpsertAddressInput) => Promise<string | null>;
  onDelete: (addressId: string) => Promise<string | null>;
}

export function ManageAddressSheet({
  visible,
  address,
  onClose,
  onSave,
  onDelete,
}: ManageAddressSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const busy = isSaving || isDeleting;

  useEffect(() => {
    if (!visible) return;
    if (address) {
      setTitle(address.title || '');
      setLine1(address.addressLine1 || '');
      setLine2(address.addressLine2 || '');
      setCity(address.city || '');
      setState(address.state || '');
      setPostal(address.postalCode || '');
      setCountry(address.country || '');
      setIsDefault(address.isDefault);
    } else {
      setTitle('');
      setLine1('');
      setLine2('');
      setCity('');
      setState('');
      setPostal('');
      setCountry('');
      setIsDefault(false);
    }
    setValidationError(null);
    setSubmitError(null);
  }, [visible, address]);

  useEffect(() => {
    if (!visible) {
      setShowDeleteConfirm(false);
      setIsDeleting(false);
    }
  }, [visible]);

  const handleSave = async () => {
    setValidationError(null);
    setSubmitError(null);
    const err = validate(title, line1, line2, city, state, postal, country);
    if (err) {
      setValidationError(err);
      return;
    }
    setIsSaving(true);
    try {
      const input: UpsertAddressInput = {
        ...(address ? { addressID: address.id } : {}),
        title: title.trim() || undefined,
        addressLine1: line1.trim() || undefined,
        addressLine2: line2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postalCode: postal.trim() || undefined,
        country: country.trim() || undefined,
        isDefault,
      };
      const apiError = await onSave(input);
      if (apiError) {
        setSubmitError(apiError);
      } else {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!address) return;
    setSubmitError(null);
    setIsDeleting(true);
    try {
      const apiError = await onDelete(address.id);
      if (apiError) {
        setSubmitError(apiError);
        setShowDeleteConfirm(false);
      } else {
        setShowDeleteConfirm(false);
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

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
      <View style={styles.modalRoot}>
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
              {address ? t('profile.addresses.editTitle') : t('profile.addresses.addTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('profile.addresses.subtitle')}
            </Text>

            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.addresses.titleLabel')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={title}
                onChangeText={setTitle}
                placeholder={t('profile.addresses.titlePlaceholder')}
                maxLength={TITLE_MAX}
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.addresses.line1')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={line1}
                onChangeText={setLine1}
                placeholder={t('profile.addresses.line1Placeholder')}
                maxLength={LINE_MAX}
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.addresses.line2')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={line2}
                onChangeText={setLine2}
                placeholder={t('profile.addresses.line2Placeholder')}
                maxLength={LINE_MAX}
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.addresses.city')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={city}
                onChangeText={setCity}
                maxLength={CITY_MAX}
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.addresses.state')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={state}
                onChangeText={setState}
                maxLength={STATE_MAX}
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.addresses.postalCode')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={postal}
                onChangeText={setPostal}
                maxLength={POSTAL_MAX}
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.addresses.country')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={country}
                onChangeText={setCountry}
                maxLength={COUNTRY_MAX}
                autoCapitalize="characters"
                style={inputStyle}
              />

              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.bodyText }]}>
                  {t('profile.addresses.defaultToggle')}
                </Text>
                <Switch
                  value={isDefault}
                  onValueChange={setIsDefault}
                  trackColor={{ false: colors.surfaceBorder, true: colors.tint }}
                />
              </View>
            </ScrollView>

            {address && (
              <Pressable
                onPress={() => setShowDeleteConfirm(true)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.deleteButton,
                  { opacity: busy ? 0.5 : pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.deleteButtonText, { color: colors.errorColor || '#FF3B30' }]}>
                  {t('profile.addresses.delete')}
                </Text>
              </Pressable>
            )}

            {(validationError || submitError) && (
              <Text
                style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}
              >
                {validationError || submitError}
              </Text>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                onPress={onClose}
                disabled={busy}
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
                disabled={busy}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: colors.tint,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color={onTint} />
                ) : (
                  <Text style={[styles.saveButtonText, { color: onTint }]}>
                    {t('profile.addresses.save')}
                  </Text>
                )}
              </Pressable>
            </View>
            </Pressable>
          </AdaptiveKeyboardAvoidingView>
        </Pressable>

        <ConfirmationBottomSheetOverlay
          visible={showDeleteConfirm}
          title={t('profile.addresses.deleteConfirmTitle')}
          message={t('profile.addresses.deleteConfirmMessage')}
          cancelLabel={t('common.cancel')}
          confirmLabel={t('common.delete')}
          destructive
          loading={isDeleting}
          onCancel={() => !isDeleting && setShowDeleteConfirm(false)}
          onConfirm={handleConfirmDelete}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
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
    maxHeight: '90%',
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
    maxHeight: 360,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Sizing.padding.m,
    marginBottom: Sizing.padding.s,
  },
  switchLabel: {
    flex: 1,
    fontSize: 16,
    marginRight: 12,
  },
  errorText: {
    fontSize: 14,
    marginBottom: Sizing.padding.m,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Sizing.padding.m,
    marginBottom: Sizing.padding.s,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Sizing.padding.s,
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
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
