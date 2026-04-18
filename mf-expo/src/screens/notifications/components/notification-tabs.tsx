import { t } from '@/src/shared/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { NotificationTab, NotificationTabsProps } from '../models/notification-models';
import { notificationTabsStyles } from '../styles/notification-tabs.styles';

const TAB_ICONS: Record<NotificationTab, keyof typeof Ionicons.glyphMap> = {
  all: 'layers-outline',
  app: 'apps-outline',
  system: 'shield-checkmark-outline',
};

export function NotificationTabs({
  activeTab,
  onTabChange,
  tabs,
  tabUnreadCounts,
}: NotificationTabsProps) {
  const { isDark, colors } = useTheme();

  return (
    <View
      style={[
        notificationTabsStyles.wrapper,
        {
          backgroundColor: colors.settingsBackground,
          borderBottomColor: colors.surfaceBorder,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={notificationTabsStyles.scrollContent}
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          const unread = tabUnreadCounts[tab.key] ?? 0;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              style={({ pressed }) => [
                notificationTabsStyles.pill,
                {
                  backgroundColor: selected
                    ? colors.tint + (isDark ? '28' : '18')
                    : isDark
                      ? colors.inputBackground
                      : colors.surfaceBackground,
                  borderColor: selected ? colors.tint + '55' : colors.surfaceBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${tab.label}${
                unread > 0 ? `, ${t('notifications.unreadCount', { count: unread })}` : ''
              }`}
            >
              <Ionicons
                name={TAB_ICONS[tab.key]}
                size={16}
                color={selected ? colors.tint : colors.labelText}
              />
              <Text
                style={[
                  notificationTabsStyles.pillLabel,
                  { color: selected ? colors.tint : colors.bodyText },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {unread > 0 ? (
                <View
                  style={[
                    notificationTabsStyles.badge,
                    { backgroundColor: selected ? colors.tint : colors.errorColor },
                  ]}
                >
                  <Text style={notificationTabsStyles.badgeText}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
