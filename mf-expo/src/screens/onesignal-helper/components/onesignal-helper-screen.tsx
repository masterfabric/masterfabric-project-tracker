import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { ThemedText } from '@/src/shared/components/ThemedText';
import { useTranslation } from '@/src/shared/i18n';
import { getOneSignalAppId } from '@/src/shared/constants';
import Constants from 'expo-constants';
import {
  getThemeColors,
  onesignalHelper,
  useTheme,
} from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onesignalHelperScreenStyles } from '../styles/onesignal-helper-screen.styles';

const isExpoGo = Constants.appOwnership === 'expo';

export function OneSignalHelperScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const [initialized, setInitialized] = useState(onesignalHelper.isInitialized);
  const [permission, setPermission] = useState<{ granted: boolean } | null>(null);
  const [subscription, setSubscription] = useState<{
    id?: string;
    token?: string;
    optedIn?: boolean;
  } | null>(null);
  const [pushDisabled, setPushDisabled] = useState<boolean | null>(null);
  const [externalUserId, setExternalUserId] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!onesignalHelper.isInitialized) return;
    try {
      const [perm, sub, disabled] = await Promise.all([
        onesignalHelper.getPermissionAsync(),
        onesignalHelper.getSubscriptionState(),
        onesignalHelper.isPushDisabled(),
      ]);
      setPermission(perm);
      setSubscription(sub);
      setPushDisabled(disabled);
    } catch (e) {
      setPermission(null);
      setSubscription(null);
      setPushDisabled(null);
    }
  }, []);

  useEffect(() => {
    setInitialized(onesignalHelper.isInitialized);
    if (onesignalHelper.isInitialized) refreshStatus();
  }, [refreshStatus]);

  const oneSignalAppId = getOneSignalAppId();

  const handleInit = async () => {
    if (isExpoGo) {
      Alert.alert(t('helpers.onesignalHelper.expoGoTitle'), t('helpers.onesignalHelper.expoGoMessage'));
      return;
    }
    if (!oneSignalAppId) {
      Alert.alert(
        t('helpers.onesignalHelper.missingAppIdTitle'),
        t('helpers.onesignalHelper.missingAppIdMessage')
      );
      return;
    }
    setLoading(true);
    try {
      await onesignalHelper.init(oneSignalAppId, {
        promptForPush: false,
        verbose: __DEV__,
      });
      setInitialized(true);
      await refreshStatus();
    } catch (e) {
      Alert.alert(
        t('helpers.onesignalHelper.initFailedTitle'),
        (e instanceof Error ? e.message : String(e)) || t('helpers.onesignalHelper.initFailedFallback')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    if (!onesignalHelper.isInitialized) {
      Alert.alert(
        t('helpers.onesignalHelper.notInitializedTitle'),
        t('helpers.onesignalHelper.notInitializedMessage')
      );
      return;
    }
    setLoading(true);
    try {
      const granted = await onesignalHelper.requestPermission(false);
      setPermission({ granted });
      await refreshStatus();
      Alert.alert(
        granted
          ? t('helpers.onesignalHelper.permissionGranted')
          : t('helpers.onesignalHelper.permissionDenied')
      );
    } catch (e) {
      Alert.alert(
        t('common.error'),
        (e instanceof Error ? e.message : String(e)) || t('helpers.onesignalHelper.requestFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!onesignalHelper.isInitialized) {
      Alert.alert(
        t('helpers.onesignalHelper.notInitializedTitle'),
        t('helpers.onesignalHelper.notInitializedMessage')
      );
      return;
    }
    const id = externalUserId.trim();
    if (!id) {
      Alert.alert(
        t('helpers.onesignalHelper.enterUserIdTitle'),
        t('helpers.onesignalHelper.enterUserIdMessage')
      );
      return;
    }
    setLoading(true);
    try {
      await onesignalHelper.login(id);
      await refreshStatus();
      Alert.alert(t('helpers.onesignalHelper.loggedInTitle'), t('helpers.onesignalHelper.loggedInMessage', { id }));
    } catch (e) {
      Alert.alert(
        t('common.error'),
        (e instanceof Error ? e.message : String(e)) || t('helpers.onesignalHelper.loginFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!onesignalHelper.isInitialized) return;
    setLoading(true);
    try {
      await onesignalHelper.logout();
      setExternalUserId('');
      await refreshStatus();
      Alert.alert(t('helpers.onesignalHelper.loggedOutTitle'));
    } catch (e) {
      Alert.alert(
        t('common.error'),
        (e instanceof Error ? e.message : String(e)) || t('helpers.onesignalHelper.logoutFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSetPushDisabled = async (disabled: boolean) => {
    if (!onesignalHelper.isInitialized) return;
    setLoading(true);
    try {
      await onesignalHelper.setPushDisabled(disabled);
      await refreshStatus();
      Alert.alert(disabled ? t('helpers.onesignalHelper.pushDisabled') : t('helpers.onesignalHelper.pushEnabled'));
    } catch (e) {
      Alert.alert(
        t('common.error'),
        (e instanceof Error ? e.message : String(e)) || t('helpers.onesignalHelper.updateFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  return (
    <SafeAreaView
      style={[onesignalHelperScreenStyles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScreenHeader
        title={t('helpers.onesignalHelper.title')}
        subtitle={t('helpers.onesignalHelper.subtitle')}
        variant="minimal"
      />
      <ScrollView
        style={onesignalHelperScreenStyles.scrollView}
        contentContainerStyle={onesignalHelperScreenStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description card */}
        <View
          style={[
            onesignalHelperScreenStyles.card,
            {
              borderColor: colors.surfaceBorder,
              backgroundColor: colors.surfaceBackground,
            },
          ]}
        >
          <ThemedText
            style={[onesignalHelperScreenStyles.cardTitle, { color: colors.text }]}
          >
            About this helper
          </ThemedText>
          <ThemedText
            style={[onesignalHelperScreenStyles.bodyText, { color: colors.text }]}
          >
            This helper wraps react-native-onesignal for remote push notifications.
            It provides init, permission, user identification (login/logout), and
            push enable/disable. The OneSignal App ID is read from your environment
            file: EXPO_PUBLIC_ONE_SIGNAL_APP_ID (e.g. in .env.development).
          </ThemedText>
          <ThemedText
            style={[onesignalHelperScreenStyles.envNote, { color: colors.labelText }]}
          >
            App ID: {oneSignalAppId ? `set (${oneSignalAppId.slice(0, 8)}…)` : 'not set. Add to .env.development and restart Metro.'}
          </ThemedText>
        </View>

        {isExpoGo && (
          <View
            style={[
              onesignalHelperScreenStyles.card,
              {
                borderColor: colors.tint,
                backgroundColor: colors.surfaceBackground,
              },
            ]}
          >
            <ThemedText style={[onesignalHelperScreenStyles.cardTitle, { color: colors.tint }]}>
              Expo Go – OneSignal not available
            </ThemedText>
            <ThemedText style={[onesignalHelperScreenStyles.bodyText, { color: colors.text }]}>
              OneSignal uses native code and is not supported in Expo Go. To test push notifications, run a development build: npx expo run:ios or npx expo run:android.
            </ThemedText>
          </View>
        )}

        {!isNative && (
          <View
            style={[
              onesignalHelperScreenStyles.card,
              {
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.surfaceBackground,
              },
            ]}
          >
            <ThemedText style={[onesignalHelperScreenStyles.bodyText, { color: colors.text }]}>
              OneSignal remote push is only available on iOS and Android. Use a
              device or native simulator to test.
            </ThemedText>
          </View>
        )}

        {/* Init */}
        <View
          style={[
            onesignalHelperScreenStyles.card,
            {
              borderColor: colors.surfaceBorder,
              backgroundColor: colors.surfaceBackground,
            },
          ]}
        >
          <ThemedText
            style={[onesignalHelperScreenStyles.cardTitle, { color: colors.text }]}
          >
            Initialize
          </ThemedText>
          <ThemedText
            style={[onesignalHelperScreenStyles.bodyText, { color: colors.labelText }]}
          >
            Status: {initialized ? 'Initialized' : 'Not initialized'}
          </ThemedText>
          {!initialized && (
            <Pressable
              onPress={handleInit}
              disabled={loading || isExpoGo}
              style={[
                onesignalHelperScreenStyles.button,
                { backgroundColor: isExpoGo ? colors.surfaceBorder : colors.tint },
              ]}
            >
              <ThemedText
                style={[onesignalHelperScreenStyles.buttonLabel, { color: isExpoGo ? colors.labelText : '#fff' }]}
              >
                {loading ? 'Initializing…' : isExpoGo ? 'Not available in Expo Go' : 'Initialize OneSignal'}
              </ThemedText>
            </Pressable>
          )}
        </View>

        {initialized && isNative && (
          <>
            {/* Permission */}
            <View
              style={[
                onesignalHelperScreenStyles.card,
                {
                  borderColor: colors.surfaceBorder,
                  backgroundColor: colors.surfaceBackground,
                },
              ]}
            >
              <ThemedText
                style={[onesignalHelperScreenStyles.cardTitle, { color: colors.text }]}
              >
                Permission
              </ThemedText>
              {permission && (
                <View style={onesignalHelperScreenStyles.statusRow}>
                  <ThemedText
                    style={[onesignalHelperScreenStyles.statusLabel, { color: colors.labelText }]}
                  >
                    Granted
                  </ThemedText>
                  <ThemedText
                    style={[onesignalHelperScreenStyles.statusValue, { color: colors.text }]}
                  >
                    {permission.granted ? 'Yes' : 'No'}
                  </ThemedText>
                </View>
              )}
              <Pressable
                onPress={handleRequestPermission}
                disabled={loading}
                style={[
                  onesignalHelperScreenStyles.button,
                  { backgroundColor: colors.tint },
                ]}
              >
                <ThemedText
                  style={[onesignalHelperScreenStyles.buttonLabel, { color: '#fff' }]}
                >
                  Request permission
                </ThemedText>
              </Pressable>
            </View>

            {/* User ID (login / logout) */}
            <View
              style={[
                onesignalHelperScreenStyles.card,
                {
                  borderColor: colors.surfaceBorder,
                  backgroundColor: colors.surfaceBackground,
                },
              ]}
            >
              <ThemedText
                style={[onesignalHelperScreenStyles.cardTitle, { color: colors.text }]}
              >
                User identification
              </ThemedText>
              <ThemedText
                style={[onesignalHelperScreenStyles.bodyText, { color: colors.labelText }]}
              >
                Login links this device to a user (SDK v5). Use logout when the user signs out.
              </ThemedText>
              <TextInput
                style={[
                  onesignalHelperScreenStyles.input,
                  {
                    borderColor: colors.surfaceBorder,
                    color: colors.text,
                    backgroundColor: colors.background,
                  },
                ]}
                placeholder="External user ID"
                placeholderTextColor={colors.labelText}
                value={externalUserId}
                onChangeText={setExternalUserId}
                editable={!loading}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Pressable
                  onPress={handleLogin}
                  disabled={loading}
                  style={[
                    onesignalHelperScreenStyles.button,
                    { backgroundColor: colors.tint },
                  ]}
                >
                  <ThemedText
                    style={[onesignalHelperScreenStyles.buttonLabel, { color: '#fff' }]}
                  >
                    Login
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleLogout}
                  disabled={loading}
                  style={[
                    onesignalHelperScreenStyles.button,
                    { backgroundColor: colors.surfaceBorder },
                  ]}
                >
                  <ThemedText
                    style={[onesignalHelperScreenStyles.buttonLabel, { color: colors.text }]}
                  >
                    Logout
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Push on/off */}
            <View
              style={[
                onesignalHelperScreenStyles.card,
                {
                  borderColor: colors.surfaceBorder,
                  backgroundColor: colors.surfaceBackground,
                },
              ]}
            >
              <ThemedText
                style={[onesignalHelperScreenStyles.cardTitle, { color: colors.text }]}
              >
                Push subscription
              </ThemedText>
              {pushDisabled !== null && (
                <View style={onesignalHelperScreenStyles.statusRow}>
                  <ThemedText
                    style={[onesignalHelperScreenStyles.statusLabel, { color: colors.labelText }]}
                  >
                    Push disabled
                  </ThemedText>
                  <ThemedText
                    style={[onesignalHelperScreenStyles.statusValue, { color: colors.text }]}
                  >
                    {pushDisabled ? 'Yes' : 'No'}
                  </ThemedText>
                </View>
              )}
              {subscription && (
                <>
                  {subscription.id != null && (
                    <View style={onesignalHelperScreenStyles.statusRow}>
                      <ThemedText
                        style={[onesignalHelperScreenStyles.statusLabel, { color: colors.labelText }]}
                      >
                        Subscription ID
                      </ThemedText>
                      <ThemedText
                        style={[onesignalHelperScreenStyles.statusValue, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {String(subscription.id).slice(0, 20)}…
                      </ThemedText>
                    </View>
                  )}
                </>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => handleSetPushDisabled(true)}
                  disabled={loading}
                  style={[
                    onesignalHelperScreenStyles.button,
                    { backgroundColor: colors.surfaceBorder },
                  ]}
                >
                  <ThemedText
                    style={[onesignalHelperScreenStyles.buttonLabel, { color: colors.text }]}
                  >
                    Disable push
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => handleSetPushDisabled(false)}
                  disabled={loading}
                  style={[
                    onesignalHelperScreenStyles.button,
                    { backgroundColor: colors.tint },
                  ]}
                >
                  <ThemedText
                    style={[onesignalHelperScreenStyles.buttonLabel, { color: '#fff' }]}
                  >
                    Enable push
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
