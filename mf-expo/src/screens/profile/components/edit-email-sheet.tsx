import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { t } from '@/src/shared/i18n';
import { mfGoOTP } from '@/src/shared/services/mf-go-api';
import type { OTPChannel } from '@/src/shared/services/mf-go-api';
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

const EMAIL_MAX = 255;
const OTP_LEN = 6;

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function isPlausibleEmail(s: string): boolean {
  const v = normalizeEmail(s);
  if (!v || v.length > EMAIL_MAX) return false;
  const at = v.indexOf('@');
  if (at < 1 || at !== v.lastIndexOf('@')) return false;
  const domain = v.slice(at + 1);
  return domain.includes('.') && domain.length >= 3;
}

function mapOtpRequestError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('OTP_RATE_LIMITED')) return t('otp.sheet.rateLimitWait');
  if (msg.includes('OTP_EMAIL_DISABLED')) return t('errors.otp.emailDisabled');
  if (msg.includes('OTP_EMAIL_FAILED')) return t('errors.otp.emailFailed');
  if (msg.includes('OTP_NO_EMAIL')) return t('errors.otp.noEmail');
  if (msg.includes('OTP_NO_TELEGRAM')) return t('errors.otp.noTelegram');
  if (msg.includes('OTP_NO_PHONE')) return t('errors.otp.noPhone');
  return t('otp.sheet.requestFailed');
}

function mapVerifyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('OTP_INVALID')) return t('otp.sheet.verifyFailed');
  if (msg.includes('OTP_EXPIRED')) return t('otp.sheet.codeExpired');
  if (msg.includes('OTP_MAX_ATTEMPTS')) return t('otp.sheet.verifyFailed');
  if (msg.includes('OTP_NOT_FOUND')) return t('otp.sheet.codeExpired');
  return t('otp.sheet.verifyFailed');
}

interface EditEmailSheetProps {
  visible: boolean;
  currentEmail: string;
  onClose: () => void;
  onSave: (email: string, verifiedEmailChangeOtpId: string) => Promise<string | null>;
}

export function EditEmailSheet({
  visible,
  currentEmail,
  onClose,
  onSave,
}: EditEmailSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [deliveryChannel, setDeliveryChannel] = useState<OTPChannel | null>(null);
  const [verifiedOtpId, setVerifiedOtpId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail(currentEmail.trim());
      setOtpCode('');
      setDeliveryChannel(null);
      setVerifiedOtpId(null);
      setValidationError(null);
      setSubmitError(null);
      setSendError(null);
      setVerifyError(null);
    }
  }, [visible, currentEmail]);

  const nextNorm = normalizeEmail(email);
  const currentNorm = normalizeEmail(currentEmail);
  const emailChanged = nextNorm !== currentNorm && isPlausibleEmail(nextNorm);

  const channelHint =
    deliveryChannel === 'EMAIL'
      ? t('profile.account.otpChannelEmail', { email: currentEmail.trim() })
      : deliveryChannel === 'ADMIN_PANEL'
        ? t('profile.account.otpChannelAdmin')
        : null;

  const handleSendCode = async () => {
    setSendError(null);
    setVerifyError(null);
    setValidationError(null);
    if (!emailChanged) {
      setValidationError(t('profile.account.emailSameAsCurrent'));
      return;
    }
    setIsSending(true);
    try {
      const payload = await mfGoOTP.request('EMAIL_CHANGE');
      setDeliveryChannel(payload.channel);
      setOtpCode('');
      setVerifiedOtpId(null);
    } catch (e) {
      setSendError(mapOtpRequestError(e));
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    setVerifyError(null);
    const code = otpCode.trim();
    if (code.length !== OTP_LEN) {
      setVerifyError(t('otp.sheet.invalidCode'));
      return;
    }
    setIsVerifying(true);
    try {
      const res = await mfGoOTP.verify(code, 'EMAIL_CHANGE');
      if (res.verified && res.otpID) {
        setVerifiedOtpId(res.otpID);
      } else {
        setVerifyError(t('otp.sheet.verifyFailed'));
      }
    } catch (e) {
      setVerifyError(mapVerifyError(e));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async () => {
    setValidationError(null);
    setSubmitError(null);
    if (!isPlausibleEmail(nextNorm)) {
      setValidationError(t('profile.account.emailInvalid'));
      return;
    }
    if (nextNorm === currentNorm) {
      onClose();
      return;
    }
    if (!verifiedOtpId) {
      setSubmitError(t('profile.account.emailOtpRequired'));
      return;
    }
    setIsSaving(true);
    try {
      const apiError = await onSave(nextNorm, verifiedOtpId);
      if (apiError) {
        setSubmitError(apiError);
      } else {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const canSave =
    emailChanged && verifiedOtpId != null && isPlausibleEmail(nextNorm) && !isSaving;

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
              {t('profile.account.emailSheetTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.labelText }]}>
              {t('profile.account.emailSheetSubtitleOtp')}
            </Text>

            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.miniLabel, { color: colors.labelText }]}>
                {t('profile.account.currentEmailLabel')}
              </Text>
              <Text style={[styles.currentEmail, { color: colors.bodyText }]}>
                {currentEmail.trim() || '—'}
              </Text>

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.account.emailLabel')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setVerifiedOtpId(null);
                  setDeliveryChannel(null);
                  setOtpCode('');
                }}
                placeholder={t('profile.account.emailPlaceholder')}
                maxLength={EMAIL_MAX}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                style={inputStyle}
              />

              <Text style={[styles.label, { color: colors.labelText, marginTop: 12 }]}>
                {t('profile.account.emailOtpStepTitle')}
              </Text>
              <Pressable
                onPress={handleSendCode}
                disabled={!emailChanged || isSending}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: colors.surfaceBorder,
                    backgroundColor: colors.surfaceBackground,
                    opacity: !emailChanged || isSending ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color={colors.tint} />
                ) : (
                  <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>
                    {t('profile.account.sendOtpToCurrent')}
                  </Text>
                )}
              </Pressable>
              {sendError ? (
                <Text style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}>
                  {sendError}
                </Text>
              ) : null}
              {channelHint ? (
                <Text style={[styles.hint, { color: colors.labelText }]}>{channelHint}</Text>
              ) : null}

              <Text style={[styles.label, { color: colors.labelText }]}>
                {t('profile.account.otpCodeLabel')}
              </Text>
              <TextInput
                {...textInputTheme}
                value={otpCode}
                onChangeText={(v) => {
                  setOtpCode(v.replace(/\D/g, '').slice(0, OTP_LEN));
                  setVerifyError(null);
                }}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={OTP_LEN}
                style={inputStyle}
              />
              <Pressable
                onPress={handleVerify}
                disabled={otpCode.trim().length !== OTP_LEN || isVerifying}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: colors.surfaceBorder,
                    backgroundColor: colors.surfaceBackground,
                    marginTop: 8,
                    opacity: otpCode.trim().length !== OTP_LEN || isVerifying ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {isVerifying ? (
                  <ActivityIndicator color={colors.tint} />
                ) : (
                  <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>
                    {t('otp.sheet.verify')}
                  </Text>
                )}
              </Pressable>
              {verifyError ? (
                <Text style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}>
                  {verifyError}
                </Text>
              ) : null}
              {verifiedOtpId ? (
                <Text style={[styles.okHint, { color: colors.tint }]}>
                  {t('profile.account.otpVerified')}
                </Text>
              ) : null}
            </ScrollView>

            {(validationError || submitError) && (
              <Text style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}>
                {validationError || submitError}
              </Text>
            )}

            <Text style={[styles.actionsHint, { color: colors.labelText }]}>
              {t('profile.account.emailHintOtp')}
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
                disabled={!canSave}
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
                  <ActivityIndicator color={onTint} />
                ) : (
                  <Text
                    style={[
                      styles.saveButtonText,
                      {
                        color: canSave && !isSaving ? onTint : colors.labelText,
                      },
                    ]}
                  >
                    {t('profile.account.emailSave')}
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
    maxHeight: '92%',
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
    marginBottom: Sizing.padding.m,
  },
  scroll: {
    maxHeight: 420,
    marginBottom: Sizing.padding.s,
  },
  miniLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  currentEmail: {
    fontSize: 15,
    marginBottom: Sizing.padding.m,
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
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: Sizing.padding.m,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
    opacity: 0.9,
  },
  okHint: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
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
    marginBottom: Sizing.padding.s,
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
