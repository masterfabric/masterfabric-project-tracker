import { t } from '@/src/shared/i18n';
import { useNotificationStore } from '@/src/screens/notifications/store/notification-store';
import { useAppStore } from '@/src/shared/store';
import { Ionicons } from '@expo/vector-icons';
import { Sizing, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { headerActionsStyles as styles } from '../styles/header-actions.styles';
import { getHeaderIconName } from '../utils';

export interface HeaderActionsProps {
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || '?';
}

export function HeaderActions({
  onNotificationPress = () => {},
  onProfilePress,
}: HeaderActionsProps) {
  /** Resolved dark mode — not `currentTheme === 'dark'` (breaks when theme is "system"). */
  const { isDark, colors } = useTheme();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const user = useAppStore((s) => s.user);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.iconButton,
          {
            backgroundColor: isDark
              ? 'rgba(44, 44, 46, 0.75)'
              : colors.headerBackground,
          },
        ]}
        onPress={onNotificationPress}
        accessibilityLabel={t('accessibility.notifications')}
        accessibilityHint={
          unreadCount > 0 ? t('accessibility.notificationsUnreadHint', { count: unreadCount }) : undefined
        }
      >
        <Ionicons
          name={getHeaderIconName('notification') as any}
          size={Sizing.icon.m}
          color={colors.headerIcon}
        />
        {unreadCount > 0 ? (
          <View
            style={[
              styles.badge,
              {
                borderColor: isDark ? colors.headerBackground : '#fff',
                backgroundColor: colors.errorColor,
              },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {isAuthenticated && user && onProfilePress && (
        <Pressable
          style={[
            styles.iconButton,
            styles.profileCircle,
            {
              backgroundColor: isDark
                ? 'rgba(44, 44, 46, 0.75)'
                : colors.headerBackground,
              borderColor: colors.settingsCardBorder,
              borderWidth: 2,
            },
          ]}
          onPress={onProfilePress}
          accessibilityLabel={t('accessibility.profile')}
        >
          {user.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={styles.profileImage}
            />
          ) : (
            <Text style={[styles.profileInitials, { color: colors.headerIcon }]}>
              {getInitials(user.name || user.email)}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
