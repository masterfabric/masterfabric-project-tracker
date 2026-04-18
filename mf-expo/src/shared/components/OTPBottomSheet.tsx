/**
 * OTPBottomSheet — dynamic, triggered bottom sheet for OTP verification.
 * Matches the existing Modal-based sheet pattern (SignOutConfirmSheet style).
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InputAccessoryView,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/src/shared/i18n';
import { getAuthErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { AdaptiveKeyboardAvoidingView } from './AdaptiveKeyboardAvoidingView';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import type { OTPChannel, OTPPurpose } from '@/src/shared/services/mf-go-api';
import { mfGoOTP } from '@/src/shared/services/mf-go-api';

export interface OTPBottomSheetProps {
  visible: boolean;
  purpose: OTPPurpose;
  onClose: () => void;
  onVerified: (otpID: string) => void;
  skipRequest?: boolean;
  onCustomVerify?: (code: string) => Promise<{ verified: boolean; otpID: string }>;
  /** From `requestOTP.channel` — adjusts copy when codes are emailed */
  deliveryChannel?: OTPChannel | null;
  /** Delay before calling `onVerified` after success animation */
  successContinueDelayMs?: number;
}

const CODE_LENGTH = 6;

/** iOS number-pad has no return key — toolbar above keyboard for Done / Verify. */
const OTP_INPUT_ACCESSORY_ID = 'mfOtpBottomSheetAccessory';

const PURPOSE_LABEL_KEYS: Record<OTPPurpose, string> = {
  LOGIN: 'otp.sheet.purposeLogin',
  VERIFY_IDENTITY: 'otp.sheet.purposeVerifyIdentity',
  PASSWORD_RESET: 'otp.sheet.purposePasswordReset',
  ACCOUNT_ACTIVATE: 'otp.sheet.purposeAccountActivate',
  EMAIL_CHANGE: 'otp.sheet.purposeEmailChange',
};

function purposeTitle(p: OTPPurpose): string {
  return t(PURPOSE_LABEL_KEYS[p] ?? PURPOSE_LABEL_KEYS.LOGIN);
}

function successContinueLine(purpose: OTPPurpose): string {
  switch (purpose) {
    case 'LOGIN':
      return t('otp.sheet.continueLogin');
    case 'VERIFY_IDENTITY':
      return t('otp.sheet.continueVerifyIdentity');
    case 'PASSWORD_RESET':
      return t('otp.sheet.continuePasswordReset');
    case 'ACCOUNT_ACTIVATE':
      return t('otp.sheet.continueAccountActivate');
    case 'EMAIL_CHANGE':
      return t('otp.sheet.continueEmailChange');
    default:
      return t('otp.sheet.finishing');
  }
}

const DEFAULT_SUCCESS_CONTINUE_MS = 1450;

const PURPOSE_DESC_KEYS: Record<OTPPurpose, string> = {
  LOGIN: 'otp.sheet.descLogin',
  VERIFY_IDENTITY: 'otp.sheet.descVerifyIdentity',
  PASSWORD_RESET: 'otp.sheet.descPasswordReset',
  ACCOUNT_ACTIVATE: 'otp.sheet.descAccountActivate',
  EMAIL_CHANGE: 'otp.sheet.descEmailChange',
};

function basePurposeDescription(purpose: OTPPurpose): string {
  return t(PURPOSE_DESC_KEYS[purpose] ?? PURPOSE_DESC_KEYS.LOGIN);
}

export function OTPBottomSheet({
  visible,
  purpose,
  onClose,
  onVerified,
  skipRequest,
  onCustomVerify,
  deliveryChannel,
  successContinueDelayMs = DEFAULT_SUCCESS_CONTINUE_MS,
}: OTPBottomSheetProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'idle' | 'requesting' | 'input' | 'verifying' | 'success' | 'error'>('idle');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const verifySuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearVerifySuccessTimer = useCallback(() => {
    if (verifySuccessTimerRef.current) {
      clearTimeout(verifySuccessTimerRef.current);
      verifySuccessTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      clearVerifySuccessTimer();
    }
  }, [visible, clearVerifySuccessTimer]);

  useEffect(() => () => clearVerifySuccessTimer(), [clearVerifySuccessTimer]);

  useEffect(() => {
    if (visible) {
      clearVerifySuccessTimer();
      setStep(skipRequest ? 'input' : 'idle');
      setCode('');
      setErrorMsg('');
      setExpiresAt(skipRequest ? new Date(Date.now() + 5 * 60 * 1000) : null);
      setCountdown(0);
      if (skipRequest) {
        setTimeout(() => inputRef.current?.focus(), 400);
      }
    }
  }, [visible, skipRequest, clearVerifySuccessTimer]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) setStep('error');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const handleRequest = useCallback(async () => {
    const wasInput = step === 'input';
    setStep('requesting');
    setErrorMsg('');
    try {
      const resp = await mfGoOTP.request(purpose);
      setExpiresAt(new Date(resp.expiresAt));
      setStep('input');
      setTimeout(() => inputRef.current?.focus(), 300);
    } catch (err: unknown) {
      const msg = getAuthErrorMessage(err) || t('otp.sheet.requestFailed');
      const rateLimited =
        msg.includes('please wait') ||
        msg.includes('OTP_RATE_LIMITED') ||
        (Array.isArray(err?.response?.errors) &&
          err.response.errors.some((e: { extensions?: { code?: string } }) => e?.extensions?.code === 'OTP_RATE_LIMITED'));
      if (rateLimited && wasInput) {
        setErrorMsg(t('otp.sheet.rateLimitWait'));
        setStep('input');
        return;
      }
      setErrorMsg(msg);
      setStep('error');
    }
  }, [purpose, step]);

  const handleVerify = useCallback(async () => {
    if (code.length !== CODE_LENGTH || step !== 'input') return;
    setStep('verifying');
    setErrorMsg('');
    try {
      const resp = onCustomVerify
        ? await onCustomVerify(code)
        : await mfGoOTP.verify(code, purpose);
      if (resp.verified) {
        Keyboard.dismiss();
        clearVerifySuccessTimer();
        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          /* haptics unavailable */
        }
        setStep('success');
        verifySuccessTimerRef.current = setTimeout(() => {
          verifySuccessTimerRef.current = null;
          InteractionManager.runAfterInteractions(() => {
            onVerified(resp.otpID);
          });
        }, successContinueDelayMs);
      } else {
        setErrorMsg(t('otp.sheet.verifyFailed'));
        setStep('input');
      }
    } catch (err: unknown) {
      setErrorMsg(getAuthErrorMessage(err) || t('otp.sheet.invalidCode'));
      setStep('input');
      setCode('');
    }
  }, [
    code,
    step,
    purpose,
    onVerified,
    onCustomVerify,
    clearVerifySuccessTimer,
    successContinueDelayMs,
  ]);

  useEffect(() => {
    if (code.length === CODE_LENGTH && step === 'input') {
      handleVerify();
    }
  }, [code, step, handleVerify]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const purposeDescription =
    purpose === 'VERIFY_IDENTITY' && deliveryChannel === 'ADMIN_PANEL'
      ? t('otp.sheet.descIdentityAdminPanel')
      : purpose === 'VERIFY_IDENTITY' && deliveryChannel === 'EMAIL'
        ? t('otp.sheet.descIdentityEmail')
        : purpose === 'VERIFY_IDENTITY' && deliveryChannel === 'WHATSAPP'
          ? t('otp.sheet.descIdentityWhatsapp')
          : purpose === 'VERIFY_IDENTITY' && deliveryChannel === 'TELEGRAM'
            ? t('otp.sheet.descIdentityTelegram')
            : purpose === 'EMAIL_CHANGE' && deliveryChannel === 'ADMIN_PANEL'
              ? t('otp.sheet.descIdentityAdminPanel')
              : purpose === 'EMAIL_CHANGE' && deliveryChannel === 'EMAIL'
                ? t('otp.sheet.descIdentityEmail')
                : basePurposeDescription(purpose);

  const tint = colors.tint;
  const activeBoxBorder = tint;
  const inactiveBoxBorder = colors.surfaceBorder;
  const boxBg = colors.surfaceBackground;

  const canVerifyFromKeyboard = code.length === CODE_LENGTH && step === 'input';
  /** After verify succeeds, block dismiss until `onVerified` runs (auth/session may already be updated). */
  const isCompletingSuccess = step === 'success';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        if (!isCompletingSuccess) onClose();
      }}
    >
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={OTP_INPUT_ACCESSORY_ID}>
          <View
            style={[
              styles.otpAccessoryBar,
              {
                backgroundColor: colors.surfaceBackground,
                borderTopColor: colors.surfaceBorder,
              },
            ]}
          >
            <Pressable onPress={() => Keyboard.dismiss()} hitSlop={12} accessibilityRole="button">
              <Text style={[styles.otpAccessoryBtn, { color: colors.labelText }]}>
                {t('otp.sheet.done')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleVerify()}
              disabled={!canVerifyFromKeyboard}
              hitSlop={12}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.otpAccessoryBtn,
                  styles.otpAccessoryBtnPrimary,
                  { color: tint, opacity: canVerifyFromKeyboard ? 1 : 0.45 },
                ]}
              >
                {t('otp.sheet.verify')}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      <Pressable
        style={styles.overlay}
        onPress={onClose}
        disabled={isCompletingSuccess}
      >
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
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header icon + title */}
          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: '#FF950020' }]}>
              <Ionicons name="key" size={26} color="#FF9500" />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={[styles.title, { color: colors.bodyText }]}>{purposeTitle(purpose)}</Text>
              {countdown > 0 && step !== 'success' && (
                <Text style={[styles.subtitle, { color: colors.labelText }]}>
                  {t('otp.sheet.expiresIn', { time: formatCountdown(countdown) })}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              disabled={isCompletingSuccess}
              style={{ opacity: isCompletingSuccess ? 0.35 : 1 }}
              accessibilityState={{ disabled: isCompletingSuccess }}
            >
              <Ionicons name="close-circle" size={28} color={colors.labelText} />
            </Pressable>
          </View>

          {/* ── IDLE: Request code button ───────────────────────── */}
          {step === 'idle' && (
            <View style={styles.bodySection}>
              <Text style={[styles.description, { color: colors.bodyText }]}>{t('otp.sheet.idleBody')}</Text>
              <Pressable
                onPress={handleRequest}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: tint, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Ionicons name="send-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>{t('otp.sheet.requestCode')}</Text>
              </Pressable>
            </View>
          )}

          {/* ── REQUESTING: spinner ─────────────────────────────── */}
          {step === 'requesting' && (
            <View style={styles.centerSection}>
              <ActivityIndicator size="large" color={tint} />
              <Text style={[styles.description, { color: colors.labelText, marginTop: 12 }]}>
                {t('otp.sheet.requesting')}
              </Text>
            </View>
          )}

          {/* ── INPUT / VERIFYING: code boxes ───────────────────── */}
          {(step === 'input' || step === 'verifying') && (
            <View style={styles.bodySection}>
              <Text style={[styles.description, { color: colors.bodyText }]}>{purposeDescription}</Text>

              {/* Code boxes */}
              <Pressable
                style={styles.codeRow}
                onPress={() => inputRef.current?.focus()}
              >
                {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                  const isCurrent = code.length === i;
                  const isFilled = i < code.length;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.codeBox,
                        {
                          borderColor: isCurrent ? activeBoxBorder : isFilled ? tint + '60' : inactiveBoxBorder,
                          backgroundColor: isFilled ? tint + '10' : boxBg,
                          transform: [{ scale: isCurrent ? 1.08 : 1 }],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.codeDigit,
                          { color: isFilled ? tint : colors.labelText },
                        ]}
                      >
                        {code[i] ?? ''}
                      </Text>
                      {isCurrent && (
                        <View style={[styles.cursor, { backgroundColor: tint }]} />
                      )}
                    </View>
                  );
                })}
              </Pressable>

              <TextInput
                ref={inputRef}
                style={styles.hiddenInput}
                value={code}
                onChangeText={(txt) => setCode(txt.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                maxLength={CODE_LENGTH}
                autoFocus={Platform.OS !== 'web'}
                caretHidden
                textContentType="oneTimeCode"
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                inputAccessoryViewID={Platform.OS === 'ios' ? OTP_INPUT_ACCESSORY_ID : undefined}
                returnKeyType={Platform.OS === 'android' ? 'done' : 'default'}
                returnKeyLabel={Platform.OS === 'android' ? t('otp.sheet.verify') : undefined}
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  if (Platform.OS === 'android' && canVerifyFromKeyboard) {
                    void handleVerify();
                  }
                }}
              />

              {/* Error message */}
              {errorMsg ? (
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Verifying spinner */}
              {step === 'verifying' && (
                <View style={[styles.centerSection, { paddingVertical: 12 }]}>
                  <ActivityIndicator size="small" color={tint} />
                  <Text style={[styles.verifyingText, { color: colors.labelText }]}>
                    {t('otp.sheet.verifying')}
                  </Text>
                </View>
              )}

              {/* Resend button */}
              {step === 'input' && !skipRequest && (
                <Pressable
                  onPress={handleRequest}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    { borderColor: colors.surfaceBorder, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={[styles.secondaryBtnText, { color: tint }]}>{t('otp.sheet.resendCode')}</Text>
                </Pressable>
              )}

              {/* Cancel button */}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  {
                    backgroundColor: colors.surfaceBackground,
                    borderColor: colors.surfaceBorder,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.bodyText }]}>
                  {t('otp.sheet.cancel')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── SUCCESS ─────────────────────────────────────────── */}
          {step === 'success' && (
            <View style={styles.centerSection}>
              <View style={[styles.successCircle, { backgroundColor: '#34C75920' }]}>
                <Ionicons name="checkmark-circle" size={56} color="#34C759" />
              </View>
              <Text style={[styles.successTitle, { color: colors.bodyText }]}>
                {t('otp.sheet.verifiedTitle')}
              </Text>
              <Text style={[styles.successSub, { color: colors.labelText }]}>
                {purpose === 'LOGIN' ? t('otp.sheet.verifiedBodyLogin') : t('otp.sheet.verifiedBodyGeneric')}
              </Text>
            </View>
          )}

          {/* ── ERROR ───────────────────────────────────────────── */}
          {step === 'error' && (
            <View style={styles.centerSection}>
              <View style={[styles.errorCircle, { backgroundColor: '#FF3B3020' }]}>
                <Ionicons name="close-circle" size={56} color="#FF3B30" />
              </View>
              <Text style={[styles.errorTitle, { color: colors.bodyText }]}>
                {errorMsg || t('otp.sheet.codeExpired')}
              </Text>
              <Text style={[styles.successSub, { color: colors.labelText }]}>
                {t('otp.sheet.codeExpiredHint')}
              </Text>
              <View style={styles.errorActions}>
                <Pressable
                  onPress={handleRequest}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: tint, opacity: pressed ? 0.9 : 1, flex: 1 },
                  ]}
                >
                  <Ionicons name="refresh-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>{t('otp.sheet.requestNewCode')}</Text>
                </Pressable>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    {
                      backgroundColor: colors.surfaceBackground,
                      borderColor: colors.surfaceBorder,
                      opacity: pressed ? 0.8 : 1,
                      flex: 1,
                      marginTop: 0,
                    },
                  ]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.bodyText }]}>{t('otp.sheet.cancel')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
        </AdaptiveKeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** Same as BroadcastNotificationSheet / EditProfileSheet — keeps sheet above keyboard. */
  keyboardView: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  otpAccessoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Sizing.padding.l,
    paddingVertical: Sizing.padding.m,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  otpAccessoryBtn: {
    fontSize: 17,
  },
  otpAccessoryBtnPrimary: {
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
    ...(Platform.OS === 'android' && { elevation: 999 }),
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Sizing.padding.l,
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  bodySection: {
    paddingBottom: Sizing.padding.s,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Sizing.padding.l,
    opacity: 0.9,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: Sizing.padding.l,
  },
  codeBox: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeDigit: {
    fontSize: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cursor: {
    position: 'absolute',
    bottom: 10,
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  /** Non-zero size so Android IME still shows Done / fires onSubmitEditing. */
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
    left: 0,
    top: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Sizing.padding.m,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  verifyingText: {
    fontSize: 14,
    marginTop: 6,
  },
  centerSection: {
    alignItems: 'center',
    paddingVertical: Sizing.padding.xl,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  errorCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  successSub: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: Sizing.padding.s,
  },
  successProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: Sizing.padding.l,
  },
  successProgressLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorActions: {
    flexDirection: 'column',
    gap: Sizing.gap.m,
    width: '100%',
    marginTop: Sizing.padding.l,
  },
  primaryBtn: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: Sizing.padding.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: Sizing.padding.m,
    alignItems: 'center',
    marginBottom: Sizing.gap.m,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: Sizing.padding.m,
    alignItems: 'center',
    marginTop: Sizing.gap.s,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
