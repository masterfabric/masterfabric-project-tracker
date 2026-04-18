import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import {
  MessageBottomSheet,
  okSheetAction,
  type MessageSheetAction,
} from '@/src/shared/components/MessageBottomSheet';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { authCredentials } from '@/src/shared/services/auth-credentials';
import { mfGoAuth } from '@/src/shared/services/mf-go-api';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Sizing, useTheme } from 'masterfabric-expo-core';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthInput } from './AuthInput';
import { mfGoAuthStyles as styles } from '../styles/mf-go-auth.styles';

type Step = 'email' | 'reset';

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

type SheetConfig = {
  title: string;
  message: string;
  variant: 'info' | 'success' | 'error';
  primaryAction: MessageSheetAction;
  secondaryAction?: MessageSheetAction;
};

export type ForgotPasswordScreenProps = {
  /** When set (e.g. from Profile), pre-fills the email step and skips relying only on last-used email. */
  initialEmail?: string | null;
};

export function ForgotPasswordScreen({ initialEmail }: ForgotPasswordScreenProps = {}) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollContentBottomPad = insets.bottom + Sizing.padding.xl;
  const onTint = foregroundOnTint(isDark);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<SheetConfig | null>(null);

  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fromRoute = initialEmail?.trim();
      if (fromRoute) {
        if (!cancelled) setEmail(normalizeEmail(fromRoute));
        return;
      }
      const last = await authCredentials.getLastEmail();
      if (!cancelled && last.trim()) {
        setEmail((prev) => (prev.trim() === '' ? last.trim() : prev));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialEmail]);

  const sendEmail = async () => {
    const e = normalizeEmail(email);
    if (!e) {
      setSheet({
        title: t('common.error'),
        message: t('auth.forgotPassword.emailRequired'),
        variant: 'error',
        primaryAction: okSheetAction(() => setSheet(null)),
      });
      return;
    }
    setLoading(true);
    try {
      await mfGoAuth.requestPasswordReset(e);
      setSheet({
        title: t('common.success'),
        message: t('auth.forgotPassword.emailSentHint'),
        variant: 'success',
        primaryAction: {
          label: t('common.ok'),
          onPress: () => {
            setSheet(null);
            setStep('reset');
          },
        },
      });
    } catch (err) {
      setSheet({
        title: t('common.error'),
        message: getGraphQLErrorMessage(err),
        variant: 'error',
        primaryAction: okSheetAction(() => setSheet(null)),
      });
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async () => {
    const e = normalizeEmail(email);
    const c = code.trim();
    const p = newPassword;
    if (!e || !c || c.length !== 6) {
      setSheet({
        title: t('common.error'),
        message: t('auth.forgotPassword.codeInvalid'),
        variant: 'error',
        primaryAction: okSheetAction(() => setSheet(null)),
      });
      return;
    }
    if (p.length < 8) {
      setSheet({
        title: t('common.error'),
        message: t('auth.forgotPassword.passwordTooShort'),
        variant: 'error',
        primaryAction: okSheetAction(() => setSheet(null)),
      });
      return;
    }
    setLoading(true);
    try {
      const ok = await mfGoAuth.resetPasswordWithOtp(e, c, p);
      if (ok) {
        await authCredentials.clearSavedPassword();
        await authCredentials.setLastEmail(e);
        setSheet({
          title: t('common.success'),
          message: t('auth.forgotPassword.resetSuccess'),
          variant: 'success',
          primaryAction: {
            label: t('common.ok'),
            onPress: () => {
              setSheet(null);
              router.replace('/mf-go-auth');
            },
          },
        });
      } else {
        setSheet({
          title: t('common.error'),
          message: t('errors.auth.invalidCredentials'),
          variant: 'error',
          primaryAction: okSheetAction(() => setSheet(null)),
        });
      }
    } catch (err) {
      setSheet({
        title: t('common.error'),
        message: getGraphQLErrorMessage(err),
        variant: 'error',
        primaryAction: okSheetAction(() => setSheet(null)),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppBarScaffold
        backgroundColor={colors.background}
        safeAreaEdges={['top']}
        appBar={
          <ScreenHeader
            title={t('auth.forgotPassword.title')}
            subtitle={t('auth.forgotPassword.subtitle')}
            onBackPress={() => router.back()}
            variant="minimal"
          />
        }
      >
        <AdaptiveKeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 8, paddingBottom: scrollContentBottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {step === 'email' ? (
            <>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14,
                  backgroundColor: cardBg,
                }}
              >
                <Text
                  style={{
                    fontWeight: '600',
                    fontSize: Sizing.typography.fontSize.m,
                    color: colors.bodyText,
                    marginBottom: 8,
                  }}
                >
                  {t('auth.forgotPassword.infoCardEmailTitle')}
                </Text>
                <Text style={{ color: colors.labelText, lineHeight: 22, fontSize: 15 }}>
                  {t('auth.forgotPassword.infoCardEmailBody')}
                </Text>
              </View>
              <Text style={[styles.errorText, { color: colors.bodyText, marginBottom: 10 }]}>
                {t('auth.forgotPassword.stepEmailHint')}
              </Text>
              <AuthInput
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                showClearButton
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
              />
              <Pressable
                onPress={() => void sendEmail()}
                disabled={loading}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: colors.tint,
                    opacity: pressed || loading ? 0.85 : 1,
                    marginTop: 16,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={onTint} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: onTint }]}>
                    {t('auth.forgotPassword.sendCode')}
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14,
                  backgroundColor: cardBg,
                }}
              >
                <Text
                  style={{
                    fontWeight: '600',
                    fontSize: Sizing.typography.fontSize.m,
                    color: colors.bodyText,
                    marginBottom: 8,
                  }}
                >
                  {t('auth.forgotPassword.infoCardResetTitle')}
                </Text>
                <Text style={{ color: colors.labelText, lineHeight: 22, fontSize: 15 }}>
                  {t('auth.forgotPassword.infoCardResetBody')}
                </Text>
              </View>
              <Text style={[styles.errorText, { color: colors.bodyText, marginBottom: 10 }]}>
                {t('auth.forgotPassword.stepResetHint')}
              </Text>
              <Text style={{ color: colors.labelText, marginBottom: 8, fontSize: 14 }}>
                {normalizeEmail(email)}
              </Text>
              <Text style={[styles.errorText, { color: colors.labelText, marginBottom: 4 }]}>
                {t('auth.forgotPassword.codeLabel')}
              </Text>
              <TextInput
                style={[
                  {
                    borderWidth: 1,
                    borderColor: colors.surfaceBorder,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 20,
                    color: colors.bodyText,
                    marginBottom: 12,
                    letterSpacing: 6,
                    textAlign: 'center',
                  },
                ]}
                value={code}
                onChangeText={(x) => setCode(x.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor={colors.labelText}
                accessibilityLabel={t('auth.forgotPassword.codeLabel')}
              />
              <AuthInput
                placeholder={t('auth.forgotPassword.newPasswordPlaceholder')}
                value={newPassword}
                onChangeText={setNewPassword}
                showPasswordToggle
                textContentType="newPassword"
                autoComplete="password-new"
              />
              <Pressable
                onPress={() => void submitReset()}
                disabled={loading}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: colors.tint,
                    opacity: pressed || loading ? 0.85 : 1,
                    marginTop: 16,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={onTint} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: onTint }]}>
                    {t('auth.forgotPassword.setPassword')}
                  </Text>
                )}
              </Pressable>
              <Pressable onPress={() => setStep('email')} style={{ marginTop: 16 }}>
                <Text style={{ color: colors.tint }}>{t('auth.forgotPassword.backToEmail')}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
        </AdaptiveKeyboardAvoidingView>
      </AppBarScaffold>

      {sheet ? (
        <MessageBottomSheet
          visible
          onDismiss={() => setSheet(null)}
          title={sheet.title}
          message={sheet.message}
          variant={sheet.variant}
          primaryAction={sheet.primaryAction}
          secondaryAction={sheet.secondaryAction}
        />
      ) : null}
    </>
  );
}
