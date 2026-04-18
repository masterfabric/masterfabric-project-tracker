import { t } from '@/src/shared/i18n';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Sizing } from 'masterfabric-expo-core';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useNotificationItemGesture, useNotificationItemTheme, useNotificationItemTime } from '../hooks/use-notification-view-model';
import { NotificationItemProps } from '../models/notification-models';
import { notificationItemStyles } from '../styles/notification-item.styles';

export function NotificationItemComponent({
  notification,
  onPress,
  onDelete,
  onEdit,
}: NotificationItemProps) {
  const { isDark, colors, getIconColor } = useNotificationItemTheme();
  const { formatTime } = useNotificationItemTime();
  const { gestureHandler, animatedStyle } = useNotificationItemGesture(notification, onDelete);
  
  // Animated values for read state transitions
  const unreadOpacity = useSharedValue(notification.isRead ? 0 : 1);
  const titleWeight = useSharedValue(notification.isRead ? 500 : 600);
  const scale = useSharedValue(1);
  
  // Update animated values when read state changes
  useEffect(() => {
    if (notification.isRead) {
      unreadOpacity.value = withTiming(0, { duration: 300 });
      titleWeight.value = withSpring(500);
      // Subtle scale animation when marking as read
      scale.value = withSequence(
        withSpring(0.98, { duration: 100 }),
        withSpring(1, { duration: 200 })
      );
    } else {
      unreadOpacity.value = withTiming(1, { duration: 200 });
      titleWeight.value = withSpring(600);
      scale.value = 1;
    }
  }, [notification.isRead]);
  
  // Animated styles for unread indicators
  const unreadIndicatorStyle = useAnimatedStyle(() => ({
    opacity: unreadOpacity.value,
  }));
  
  const unreadLineStyle = useAnimatedStyle(() => ({
    opacity: unreadOpacity.value,
  }));
  
  const titleAnimatedStyle = useAnimatedStyle(() => ({
    fontWeight: titleWeight.value as any,
  }));
  
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const handlePress = () => {
    if (!notification.isRead) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress(notification);
    if (notification.actionUrl) {
      const url = notification.actionUrl;
      if (url.startsWith('/')) {
        router.push(url as any);
      } else if (url.startsWith('http')) {
        // Could open Linking.openURL(url) if needed
      }
    }
  };

  const cardBg = isDark ? colors.surfaceBackground ?? colors.background : '#ffffff';
  const cardBorder = isDark ? colors.surfaceBorder + '88' : colors.tint + '0D';

  return (
    <GestureDetector gesture={gestureHandler}>
      <Animated.View style={[animatedStyle, notificationItemStyles.cardWrap]}>
        <Animated.View style={containerAnimatedStyle}>
        <View style={notificationItemStyles.cardInnerWrap}>
          {onEdit ? (
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                onEdit(notification);
              }}
              style={({ pressed }) => [
                notificationItemStyles.editBtn,
                { opacity: pressed ? 0.7 : 1, backgroundColor: colors.tint + '18' },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('settings.adminNotificationHistory.editAccessibility')}
            >
              <Ionicons name="create-outline" size={18} color={colors.tint} />
            </Pressable>
          ) : null}
        <Pressable
          style={({ pressed }) => [
            notificationItemStyles.container,
            {
              backgroundColor: pressed ? colors.tint + '0A' : cardBg,
              opacity: pressed ? Sizing.opacity.xl : Sizing.opacity.full,
              borderWidth: StyleSheet.hairlineWidth * 1.5,
              borderColor: cardBorder,
              shadowColor: isDark ? '#000' : '#94a3b8',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.1 : 0.04,
              shadowRadius: 14,
              elevation: 0,
            },
            !notification.isRead && notificationItemStyles.unreadContainer,
          ]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityState={{ selected: !notification.isRead }}
          accessibilityHint={t('notifications.swipeToDelete')}
        >
          <View style={notificationItemStyles.content}>
            <View style={notificationItemStyles.iconContainer}>
              <View style={[
                notificationItemStyles.iconWrapper,
                { 
                  backgroundColor: getIconColor(notification.type) + (isDark ? '15' : '10'),
                }
              ]}>
                <Ionicons
                  name={notification.icon as any || 'notifications'}
                  size={Sizing.icon.s}
                  color={getIconColor(notification.type)}
                />
              </View>
            </View>

            <View style={notificationItemStyles.textContainer}>
              <View style={notificationItemStyles.header}>
                <Animated.Text 
                  style={[
                    notificationItemStyles.title,
                    { color: colors.text },
                    titleAnimatedStyle
                  ]}
                >
                  {notification.title}
                </Animated.Text>
                {notification.priority === 'high' && (
                  <View style={[notificationItemStyles.priorityBadge, { backgroundColor: colors.errorColor + '20' }]}>
                    <Ionicons name="alert-circle" size={10} color={colors.errorColor} />
                  </View>
                )}
                <Animated.View 
                  style={[
                    notificationItemStyles.unreadIndicator,
                    { backgroundColor: getIconColor(notification.type) },
                    unreadIndicatorStyle
                  ]} 
                />
              </View>

              {notification.subtitle ? (
                <Text style={[notificationItemStyles.subtitle, { color: colors.labelText }]} numberOfLines={1}>
                  {notification.subtitle}
                </Text>
              ) : null}

              <Text style={[
                notificationItemStyles.message,
                { color: colors.bodyText }
              ]} numberOfLines={2}>
                {notification.message}
              </Text>

              {notification.imageUrl ? (
                <View style={notificationItemStyles.imageWrapper}>
                  <Image
                    source={{ uri: notification.imageUrl }}
                    style={notificationItemStyles.thumbnail}
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              <View style={notificationItemStyles.footer}>
                <View style={notificationItemStyles.metaContainer}>
                  <Ionicons 
                    name="time-outline" 
                    size={Sizing.icon.xs} 
                    color={colors.labelText} 
                    style={notificationItemStyles.timeIcon}
                  />
                  <Text style={[
                    notificationItemStyles.timestamp,
                    { color: colors.labelText }
                  ]}>
                    {formatTime(notification.timestamp)}
                  </Text>
                </View>
                
                <View style={[
                  notificationItemStyles.categoryBadge,
                  { 
                    backgroundColor: getIconColor(notification.type) + (isDark ? '15' : '08'),
                  }
                ]}>
                  <Ionicons 
                    name={notification.category === 'app' ? 'apps' : 'settings'} 
                    size={Sizing.icon.xxs} 
                    color={getIconColor(notification.type)} 
                    style={notificationItemStyles.categoryIcon}
                  />
                  <Text style={[
                    notificationItemStyles.categoryText,
                    { color: getIconColor(notification.type) }
                  ]}>
                    {notification.category === 'system'
                      ? t('notifications.category.system')
                      : notification.category === 'app'
                        ? t('notifications.category.app')
                        : notification.category}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Unread indicator line */}
          <Animated.View 
            style={[
              notificationItemStyles.unreadLine,
              { backgroundColor: getIconColor(notification.type) },
              unreadLineStyle
            ]} 
          />
          </Pressable>
        </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}


