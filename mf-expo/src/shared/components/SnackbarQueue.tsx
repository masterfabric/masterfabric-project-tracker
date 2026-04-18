/**
 * SnackbarQueue — global toast/snackbar host (root layout).
 *
 * Visual language follows **shadcn/ui**-style toasts (see [Toast](https://ui.shadcn.com/docs/components/toast) /
 * Sonner): elevated **card** surface, **border**, **foreground** text, variant **accent** (left border + icon)
 * instead of full-width solid semantic fills. React Native adaptation; keep new surfaces aligned with this pattern.
 *
 * Theme: use **`useTheme()`** from masterfabric (not `useColorScheme`) so light/dark matches in-app Settings + system mode.
 * Surfaces use explicit **light vs dark** tokens (`toastSurface` below) on top of `getThemeColors(isDark)`.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from 'masterfabric-expo-core';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnackbar } from '../hooks/use-snackbar';
import type { SnackbarProps } from '../services/snackbar-service';

/** Tab bar clearance matches `app/(tabs)/_layout` — snackbars sit above it. */
const TAB_BAR_CLEARANCE_IOS = 100;
/** Android: ~tab bar + gap; add `insets.bottom` when gesture nav reserves space (GFG-90). */
const TAB_BAR_CLEARANCE_ANDROID_BASE = 82;

interface SingleSnackbarProps {
  snackbar: SnackbarProps;
  index: number;
  onDismiss: (id: string) => void;
}

type IonName = React.ComponentProps<typeof Ionicons>['name'];

interface ToastAppearance {
  cardBg: string;
  borderColor: string;
  leftAccent: string;
  iconCircleBg: string;
  iconColor: string;
  messageColor: string;
  closeColor: string;
  iconName: IonName;
}

const EMOJI_ICONS = new Set(['✅', '❌', '⚠️', 'ℹ️']);

/** Card + border: separate chrome for light vs dark (settings-style elevated card). */
function toastSurface(colors: ThemeColors, isDark: boolean) {
  if (isDark) {
    return {
      cardBg: colors.settingsCardBackground,
      borderColor: colors.settingsCardBorder,
    };
  }
  return {
    cardBg: colors.cardBackground,
    borderColor: colors.settingsCardBorder,
  };
}

function renderLeadingIcon(
  snackbar: SnackbarProps,
  appearance: ToastAppearance
): React.ReactNode {
  const customColor = (snackbar as SnackbarProps & { customColor?: string }).customColor;
  const customIcon = (snackbar as SnackbarProps & { customIcon?: string }).customIcon;
  if (customColor && customIcon) {
    if (EMOJI_ICONS.has(customIcon)) {
      return (
        <Text style={{ fontSize: 18, lineHeight: 22 }}>{customIcon}</Text>
      );
    }
    return (
      <Ionicons name={customIcon as IonName} size={18} color={appearance.iconColor} />
    );
  }
  return <Ionicons name={appearance.iconName} size={18} color={appearance.iconColor} />;
}

function getToastAppearance(
  snackbar: SnackbarProps,
  colors: ThemeColors,
  isDark: boolean
): ToastAppearance {
  const surface = toastSurface(colors, isDark);
  const customBg = (snackbar as SnackbarProps & { customColor?: string }).customColor;

  if (customBg) {
    return {
      cardBg: surface.cardBg,
      borderColor: surface.borderColor,
      leftAccent: customBg,
      iconCircleBg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      iconColor: customBg,
      messageColor: colors.bodyText,
      closeColor: colors.labelText,
      iconName: 'color-palette',
    };
  }

  switch (snackbar.type) {
    case 'success':
      return {
        cardBg: surface.cardBg,
        borderColor: surface.borderColor,
        leftAccent: colors.successColor,
        iconCircleBg: colors.successBackground,
        iconColor: colors.successColor,
        messageColor: colors.bodyText,
        closeColor: colors.labelText,
        iconName: 'checkmark-circle',
      };
    case 'error':
      return {
        cardBg: surface.cardBg,
        borderColor: surface.borderColor,
        leftAccent: colors.errorColor,
        iconCircleBg: colors.validatorErrorBackground,
        iconColor: colors.errorColor,
        messageColor: colors.bodyText,
        closeColor: colors.labelText,
        iconName: 'close-circle',
      };
    case 'warning':
      return {
        cardBg: surface.cardBg,
        borderColor: surface.borderColor,
        leftAccent: colors.warningColor,
        iconCircleBg: isDark ? 'rgba(255, 149, 0, 0.2)' : 'rgba(255, 149, 0, 0.14)',
        iconColor: colors.warningColor,
        messageColor: colors.bodyText,
        closeColor: colors.labelText,
        iconName: 'warning',
      };
    case 'info':
    default:
      return {
        cardBg: surface.cardBg,
        borderColor: surface.borderColor,
        leftAccent: colors.tint,
        iconCircleBg: isDark ? 'rgba(235, 235, 245, 0.12)' : 'rgba(28, 28, 30, 0.08)',
        iconColor: colors.tint,
        messageColor: colors.bodyText,
        closeColor: colors.labelText,
        iconName: 'information-circle',
      };
  }
}

function SingleSnackbar({ snackbar, index, onDismiss }: SingleSnackbarProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const insets = useSafeAreaInsets();

  const [isExpanded, setIsExpanded] = React.useState(false);

  const translateY = useRef(new Animated.Value(100)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  const panGesture = Gesture.Pan()
    .activeOffsetX(10)
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.setValue(event.translationX);
        const newOpacity = Math.max(0, 1 - event.translationX / 250);
        opacity.setValue(newOpacity);
      }
    })
    .onEnd((event) => {
      const shouldDismiss = event.translationX > 80 || event.velocityX > 500;

      if (shouldDismiss) {
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 500,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => onDismiss(snackbar.id));
      } else {
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 10,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });

  const appearance = getToastAppearance(snackbar, colors, isDark);
  const isTop = snackbar.position === 'top';
  const isCenter = snackbar.position === 'center';

  const stackOffset = index * 76;
  const tabBarClearance =
    Platform.OS === 'ios'
      ? TAB_BAR_CLEARANCE_IOS
      : TAB_BAR_CLEARANCE_ANDROID_BASE + insets.bottom;
  const bottomPosition =
    isTop || isCenter ? undefined : tabBarClearance + stackOffset;
  const topPosition = isTop ? insets.top + 12 + stackOffset : isCenter ? '50%' : undefined;

  /** Elevation: light = soft black shadow; dark = deeper stack on near-black UI */
  const shadowStyle = isDark
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
        elevation: 14,
      }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
      };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.container,
          isCenter
            ? {
                top: '50%',
                transform: [{ translateY: -30 }, { translateX }],
              }
            : {
                [isTop ? 'top' : 'bottom']: isTop ? topPosition : bottomPosition,
                transform: [
                  { translateY: isTop ? Animated.multiply(translateY, -1) : translateY },
                  { translateX },
                ],
              },
          {
            opacity,
            zIndex: 9999 - index,
          },
        ]}
        pointerEvents="auto"
      >
        <View
          style={[
            styles.toastCard,
            {
              backgroundColor: appearance.cardBg,
              borderColor: appearance.borderColor,
            },
            shadowStyle,
          ]}
        >
          <View style={[styles.leftAccent, { backgroundColor: appearance.leftAccent }]} />

          <View style={styles.toastInner}>
            <View style={[styles.iconCircle, { backgroundColor: appearance.iconCircleBg }]}>
              {renderLeadingIcon(snackbar, appearance)}
            </View>

            <Pressable onPress={() => setIsExpanded(!isExpanded)} style={styles.messagePressable}>
              <Text
                style={[styles.message, { color: appearance.messageColor }]}
                numberOfLines={isExpanded ? undefined : 4}
                ellipsizeMode="tail"
              >
                {snackbar.message}
              </Text>
            </Pressable>

            {snackbar.action ? (
              <Pressable
                onPress={() => {
                  snackbar.action?.onPress();
                  onDismiss(snackbar.id);
                }}
                style={styles.actionButton}
              >
                <Text
                  style={[
                    styles.actionText,
                    {
                      color: appearance.leftAccent,
                      fontSize: snackbar.action.label.length <= 2 ? 20 : 13,
                    },
                  ]}
                >
                  {snackbar.action.label}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => onDismiss(snackbar.id)}
              style={styles.closeButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Ionicons name="close" size={18} color={appearance.closeColor} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function SnackbarQueue() {
  const { snackbars, dismissSnackbar } = useSnackbar();

  if (snackbars.length === 0) return null;

  const centerSnackbars = snackbars.filter((s) => s.position === 'center');
  const otherSnackbars = snackbars.filter((s) => s.position !== 'center');

  const displaySnackbars = [
    ...otherSnackbars,
    ...(centerSnackbars.length > 0 ? [centerSnackbars[centerSnackbars.length - 1]] : []),
  ];

  return (
    <>
      {displaySnackbars.map((snackbar, index) => (
        <SingleSnackbar
          key={snackbar.id}
          snackbar={snackbar}
          index={snackbar.position === 'center' ? 0 : index}
          onDismiss={dismissSnackbar}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
  },
  toastCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 52,
  },
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    gap: 10,
    marginLeft: 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagePressable: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
