import { getOneSignalAppId } from '@/src/shared/constants';
import { t } from '@/src/shared/i18n';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Ionicons } from '@expo/vector-icons';
import { onesignalHelper } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, Text, View } from 'react-native';

interface Props {
  colors: {
    tint: string;
    text: string;
    labelText: string;
    surfaceBorder: string;
  };
  isDark: boolean;
}

export function NotificationPushBanner({ colors, isDark }: Props) {
  const [show, setShow] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);

  const check = useCallback(async () => {
    if (Platform.OS === 'web') {
      setShow(false);
      return;
    }
    if (!getOneSignalAppId()?.trim()) {
      setShow(false);
      return;
    }
    try {
      if (!onesignalHelper.isInitialized) {
        setShow(false);
        return;
      }
      const s = await onesignalHelper.getPermissionAsync();
      setShow(!s.granted);
      setCanAskAgain(s.canAskAgain !== false);
    } catch {
      setShow(false);
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (!show) return null;

  const onPrimary = async () => {
    try {
      if (canAskAgain) {
        const ok = await onesignalHelper.requestPermission(true);
        if (ok) setShow(false);
        else await check();
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openSettings();
    }
  };

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
        padding: 14,
        borderRadius: 14,
        backgroundColor: colors.tint + (isDark ? '18' : '12'),
        borderWidth: 1,
        borderColor: colors.tint + '35',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: colors.tint + '25',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="notifications" size={20} color={colors.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
            {t('notifications.pushBanner.title')}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 18, color: colors.labelText, marginBottom: 12 }}>
            {t('notifications.pushBanner.message')}
          </Text>
          <Pressable
            onPress={onPrimary}
            style={{
              alignSelf: 'flex-start',
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 10,
              backgroundColor: colors.tint,
            }}
          >
            <Text style={{ color: foregroundOnTint(isDark), fontSize: 14, fontWeight: '600' }}>
              {canAskAgain
                ? t('notifications.pushBanner.enable')
                : t('notifications.pushBanner.openSettings')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
