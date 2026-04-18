import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { OTPBottomSheet } from '@/src/shared/components/OTPBottomSheet';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { SignOutConfirmSheet } from '@/src/shared/components/SignOutConfirmSheet';
import { useMfGoAuth } from '@/src/shared/hooks/use-mf-go-auth';
import { useSnackbar } from '@/src/shared/hooks/use-snackbar';
import { t } from '@/src/shared/i18n';
import { authCredentials } from '@/src/shared/services/auth-credentials';
import { useAppStore } from '@/src/shared/store';
import {
  clearMfGoAuthSignedInPlaceholderSuppress,
  isMfGoAuthSignedInPlaceholderSuppressed,
} from '@/src/shared/utils/mf-go-auth-signed-in-placeholder-suppress';
import { getGraphQLErrorI18nKey } from '@/src/shared/helpers/graphql-error-helper';
import { router } from 'expo-router';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { AuthCheckbox } from './AuthCheckbox';
import { AuthFeaturesCard } from './AuthFeaturesCard';
import { AuthFooter } from './AuthFooter';
import { AuthFormHeader } from './AuthFormHeader';
import { AuthInput } from './AuthInput';
import { mfGoAuthStyles as styles } from '../styles/mf-go-auth.styles';

type Tab = 'login' | 'register';

/** Matches mf-go `RegisterRequest` (`internal/application/auth/dto/auth_dto.go`). */
const REGISTER_PASSWORD_MIN_LEN = 8;
const REGISTER_DISPLAY_NAME_MIN_LEN = 2;

export function MfGoAuthScreen() {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollContentBottomPad = insets.bottom + Sizing.padding.xl;
  const onTint = foregroundOnTint(isDark);
  const user = useAppStore((s) => s.user);
  const {
    login, verifyLoginOTP, register, logout,
    isLoading, error, setError, isAuthenticated,
    pendingOTPLogin, clearPendingOTP,
  } = useMfGoAuth();
  const { showSnackbar } = useSnackbar();

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [savePassword, setSavePassword] = useState(false);
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  /** Keeps OTP sheet visible through success UX after `pendingOTPLogin` is cleared on verify. */
  const [otpFlowOpen, setOtpFlowOpen] = useState(false);

  const displayNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Pre-fill email (and optionally password) when showing login form
  const loadStoredCredentials = useCallback(async () => {
    const lastEmail = await authCredentials.getLastEmail();
    if (lastEmail) {
      setEmail(lastEmail);
      const saved = await authCredentials.getSavedPassword(lastEmail);
      if (saved) setPassword(saved);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      loadStoredCredentials();
    }
  }, [isAuthenticated, loadStoredCredentials]);

  useEffect(() => {
    if (pendingOTPLogin) setOtpFlowOpen(true);
  }, [pendingOTPLogin]);

  useEffect(() => {
    return () => {
      clearMfGoAuthSignedInPlaceholderSuppress();
    };
  }, []);

  const showPostAuthRedirectSnackbar = useCallback(
    (variant: 'signIn' | 'register') => {
      showSnackbar({
        message:
          variant === 'register'
            ? t('auth.mfGo.postRegisterRedirectSnackbar')
            : t('auth.mfGo.postSignInRedirectSnackbar'),
        type: 'success',
        duration: 3200,
      });
    },
    [showSnackbar]
  );

  const handleSignOutConfirm = async () => {
    const emailToKeep = user?.email ?? '';
    await authCredentials.setLastEmail(emailToKeep);
    await authCredentials.clearSavedPassword();
    await logout();
    setEmail(emailToKeep);
    setPassword('');
    setShowSignOutSheet(false);
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      if (tab === 'login') {
        const payload = await login(email, password);
        if (payload.otpRequired) {
          return; // OTP sheet will open via pendingOTPLogin state
        }
        showPostAuthRedirectSnackbar('signIn');
        router.replace('/(tabs)');
        await authCredentials.setLastEmail(email);
        if (savePassword && email.trim() && password) {
          await authCredentials.setSavedPassword(email.trim(), password);
        } else {
          await authCredentials.clearSavedPassword();
        }
      } else {
        await register(email, password, displayName);
        showPostAuthRedirectSnackbar('register');
        router.replace('/(tabs)');
        await authCredentials.setLastEmail(email);
      }
    } catch (e) {
      // error set by hook; snackbar for common cases (GFG-62)
      const key = getGraphQLErrorI18nKey(e);
      if (tab === 'login' && key === 'errors.auth.invalidCredentials') {
        showSnackbar({
          message: t('auth.mfGo.wrongPasswordSnackbar'),
          type: 'error',
          duration: 4200,
        });
      } else if (
        tab === 'register' &&
        key === 'auth.forgotPassword.passwordTooShort'
      ) {
        showSnackbar({
          message: t('auth.forgotPassword.passwordTooShort'),
          type: 'error',
          duration: 4200,
        });
      }
    }
  };

  const handleOTPVerified = async (_otpID: string) => {
    setOtpFlowOpen(false);
    showPostAuthRedirectSnackbar('signIn');
    router.replace('/(tabs)');
  };

  const canSubmit =
    tab === 'login'
      ? !!email.trim() && !!password
      : !!email.trim() &&
        password.length >= REGISTER_PASSWORD_MIN_LEN &&
        displayName.trim().length >= REGISTER_DISPLAY_NAME_MIN_LEN;

  if (isAuthenticated && isMfGoAuthSignedInPlaceholderSuppressed()) {
    return (
      <AppBarScaffold
        backgroundColor={colors.background}
        safeAreaEdges={['top']}
        appBar={
          <ScreenHeader
            title={t('auth.mfGo.title')}
            subtitle={t('common.loading')}
            onBackPress={() => router.back()}
            variant="minimal"
          />
        }
      >
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: scrollContentBottomPad,
          }}
        >
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </AppBarScaffold>
    );
  }

  if (isAuthenticated) {
    return (
      <>
        <AppBarScaffold
          backgroundColor={colors.background}
          safeAreaEdges={['top']}
          appBar={
            <ScreenHeader
              title={t('auth.mfGo.title')}
              subtitle={t('auth.mfGo.signedInTitle')}
              onBackPress={() => router.back()}
              variant="minimal"
            />
          }
        >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingTop: 8, paddingBottom: scrollContentBottomPad },
              ]}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              <View
                style={[
                  styles.signedInCard,
                  {
                    backgroundColor: isDark ? colors.surfaceBackground : colors.surfaceBackground,
                    borderWidth: 1,
                    borderColor: isDark ? colors.surfaceBorder : colors.surfaceBorder,
                  },
                ]}
              >
                <Text style={[styles.signedInTitle, { color: colors.bodyText }]}>
                  {t('auth.mfGo.signedInTitle')}
                </Text>
                <Text style={[styles.signedInDescription, { color: colors.bodyText }]}>
                  {t('auth.mfGo.signedInDescription')}
                </Text>
                <Pressable
                  onPress={() => setShowSignOutSheet(true)}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.signOutButton,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.signOutButtonText}>{t('auth.mfGo.logOut')}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
        </AppBarScaffold>
        <SignOutConfirmSheet
          visible={showSignOutSheet}
          onCancel={() => setShowSignOutSheet(false)}
          onConfirm={handleSignOutConfirm}
          isLoading={isLoading}
        />
      </>
    );
  }

  return (
    <>
    <AppBarScaffold
      backgroundColor={colors.background}
      safeAreaEdges={['top']}
      appBar={
        <ScreenHeader
          title={t('auth.mfGo.title')}
          subtitle={t('auth.mfGo.subtitle')}
          onBackPress={() => router.back()}
          variant="minimal"
        />
      }
    >
        <AdaptiveKeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: 8, paddingBottom: scrollContentBottomPad },
            ]}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
          <AuthFormHeader tab={tab} />

          {tab === 'register' && (
            <AuthInput
              ref={displayNameRef}
              placeholder={t('auth.mfGo.displayNamePlaceholder')}
              value={displayName}
              onChangeText={setDisplayName}
              showClearButton
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}

          <AuthInput
            ref={emailRef}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            showClearButton
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <AuthInput
            ref={passwordRef}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            showPasswordToggle
            blurOnSubmit={false}
            textContentType="password"
            autoComplete="password"
            returnKeyType="go"
            returnKeyLabel={
              Platform.OS === 'android'
                ? tab === 'login'
                  ? t('auth.signIn')
                  : t('auth.createAccountButton')
                : undefined
            }
            onSubmitEditing={() => {
              if (isLoading || !canSubmit) return;
              void handleSubmit();
            }}
          />

          {tab === 'register' && (
            <Text
              style={{
                marginTop: 6,
                fontSize: Sizing.typography.fontSize.s,
                color: colors.labelText,
              }}
            >
              {t('auth.mfGo.passwordHintEight')}
            </Text>
          )}

          {tab === 'login' && (
            <Pressable
              onPress={() => router.push('/forgot-password')}
              style={({ pressed }) => [{ alignSelf: 'flex-end', marginTop: 8, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ color: colors.tint, fontSize: Sizing.typography.fontSize.s }}>
                {t('auth.forgotPassword.link')}
              </Text>
            </Pressable>
          )}

          {tab === 'login' && (
            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <Text
                style={{
                  fontSize: Sizing.typography.fontSize.s,
                  lineHeight: 20,
                  color: colors.labelText,
                }}
              >
                {t('auth.mfGo.otpLoginHint')}
              </Text>
            </View>
          )}

          {tab === 'login' && (
            <AuthCheckbox
              checked={savePassword}
              onToggle={() => setSavePassword((c) => !c)}
              label={t('auth.mfGo.saveUserSheet.savePasswordCheckbox')}
              hint={t('auth.mfGo.saveUserSheet.savePasswordHint')}
            />
          )}

          <AuthFeaturesCard />

          {error && (
            <Text style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}>
              {error}
            </Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || isLoading}
            style={({ pressed }) => [
              styles.submitButton,
              canSubmit && !isLoading
                ? {
                    backgroundColor: colors.tint,
                    opacity: pressed ? 0.88 : 1,
                  }
                : {
                    backgroundColor: isDark
                      ? colors.buttonBackground
                      : colors.surfaceBorder,
                    opacity: pressed ? 0.85 : 0.92,
                  },
              (!canSubmit || isLoading) && styles.submitButtonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator
                color={canSubmit ? colors.text : colors.labelText}
              />
            ) : (
              <Text
                style={[
                  styles.submitButtonText,
                  {
                    color: canSubmit && !isLoading ? onTint : colors.labelText,
                  },
                ]}
              >
                {tab === 'login' ? t('auth.signIn') : t('auth.createAccountButton')}
              </Text>
            )}
          </Pressable>

          <AuthFooter
            tab={tab}
            onSwitchTab={() => setTab(tab === 'login' ? 'register' : 'login')}
          />
          </ScrollView>
        </AdaptiveKeyboardAvoidingView>
    </AppBarScaffold>

      {/* OTP verification sheet — shown when login requires 2FA */}
      <OTPBottomSheet
        visible={otpFlowOpen}
        purpose="LOGIN"
        skipRequest
        onClose={() => {
          clearPendingOTP();
          setOtpFlowOpen(false);
        }}
        onVerified={handleOTPVerified}
        onCustomVerify={async (code) => {
          const result = await verifyLoginOTP(code);
          return { verified: !!result, otpID: '' };
        }}
      />
    </>
  );
}
