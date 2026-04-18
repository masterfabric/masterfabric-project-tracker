import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/src/shared/components/HapticTab';
import { LocalizedBottomTabBar } from '@/src/shared/components/LocalizedBottomTabBar';
import { IconSymbol } from '@/src/shared/components/ui/IconSymbol';
import TabBarBackground from '@/src/shared/components/ui/TabBarBackground';
import { t } from '@/src/shared/i18n';
import { mfGoOrganizations } from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';
import { getThemeColors, useMasterView } from 'masterfabric-expo-core';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isDark } = useMasterView();
  const colors = getThemeColors(isDark);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const showOrgMessagesTab = useAppStore((s) => s.showOrgMessagesTab);
  const setShowOrgMessagesTab = useAppStore((s) => s.setShowOrgMessagesTab);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowOrgMessagesTab(false);
      return;
    }
    let cancelled = false;
    mfGoOrganizations
      .myOrganizations()
      .then((orgs) => {
        if (!cancelled) setShowOrgMessagesTab(orgs.length > 0);
      })
      .catch(() => {
        if (!cancelled) setShowOrgMessagesTab(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setShowOrgMessagesTab]);

  const androidGestureBottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  const tabBarHeight =
    Platform.OS === 'ios' ? 90 : 70 + androidGestureBottomInset;
  const tabBarPaddingBottom =
    Platform.OS === 'ios' ? 34 : 10 + androidGestureBottomInset;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <LocalizedBottomTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: colors.tabBarActiveTint,
          tabBarInactiveTintColor: colors.tabBarInactiveTint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.OS === 'web' 
            ? { display: 'none' } // Hide tab bar on web
            : {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: colors.tabBarBackground,
                borderTopWidth: 0,
                paddingBottom: tabBarPaddingBottom,
                paddingTop: 8,
                height: tabBarHeight,
                shadowColor: colors.tabBarShadow,
                shadowOffset: { width: 0, height: -3 },
                shadowOpacity: Platform.OS === 'ios' ? 0 : 0.15,
                shadowRadius: Platform.OS === 'ios' ? 0 : 10,
                elevation: Platform.OS === 'ios' ? 0 : 10,
              },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 4,
            marginBottom: Platform.OS === 'ios' ? 0 : 4,
          },
          tabBarIconStyle: {
            marginBottom: Platform.OS === 'ios' ? 0 : 2,
          },
          tabBarItemStyle: {
            paddingTop: 8,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('home.title'),
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol 
                size={focused ? 28 : 24} 
                name="house.fill" 
                color={color}
                style={{
                  opacity: focused ? 1 : 0.7,
                }} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="org-messages"
          options={{
            href: showOrgMessagesTab ? '/org-messages' : null,
            title: t('tabs.orgMessages.title'),
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol
                size={focused ? 28 : 24}
                name="message.fill"
                color={color}
                style={{
                  opacity: focused ? 1 : 0.7,
                }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('settings.title'),
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol 
                size={focused ? 28 : 24} 
                name="gearshape.fill" 
                color={color}
                style={{
                  opacity: focused ? 1 : 0.7,
                }} 
              />
            ),
          }}
        />
      </Tabs>
   
    </View>
  );
}
