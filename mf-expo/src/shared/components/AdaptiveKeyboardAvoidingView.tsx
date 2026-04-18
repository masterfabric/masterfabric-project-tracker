/**
 * Wraps KeyboardAvoidingView but disables avoidance when iOS reports a short keyboard
 * frame (hardware keyboard + thin accessory bar). That avoids shrinking / jumping the
 * whole layout while typing on a physical keyboard.
 *
 * **`tabBarScene`:** React Native's `KeyboardAvoidingView` measures the view with
 * `onLayout` and `keyboardWillShow`; that math often **under-pads** when the tab bar
 * is `position: 'absolute'` and the scaffold uses safe-area insets — the focused field
 * can sit slightly under the software keyboard. For those screens, use `tabBarScene`:
 * we apply **`paddingBottom`** from the same **`useKeyboard`** overlap used for adaptive
 * `enabled`, minus **`useSafeAreaInsets().bottom`** (that overlap is measured from the
 * window bottom; the scaffold already insets the bottom safe area), plus a small iOS
 * fudge — instead of relying on `KeyboardAvoidingView`.
 */
import { useKeyboard } from '@/src/shared/hooks/use-keyboard';
import React from 'react';
import {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
  Platform,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** iOS: frames below this are not a full software keyboard (hardware KB / shortcut bar). */
const IOS_MIN_SOFTWARE_KEYBOARD_HEIGHT = 95;

/** Small extra lift after safe-area correction (tab scenes). */
const IOS_TAB_SCENE_KEYBOARD_FUDGE = 4;

export type AdaptiveKeyboardAvoidingViewProps = KeyboardAvoidingViewProps & {
  /**
   * Use overlap-based bottom padding instead of `KeyboardAvoidingView` — for tab
   * screens whose tab bar overlays the bottom of the window.
   */
  tabBarScene?: boolean;
};

export function AdaptiveKeyboardAvoidingView({
  children,
  behavior,
  enabled: enabledOverride,
  tabBarScene = false,
  style,
  keyboardVerticalOffset,
  contentContainerStyle,
  ...rest
}: AdaptiveKeyboardAvoidingViewProps) {
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();
  const insets = useSafeAreaInsets();

  const autoEnabled =
    Platform.OS === 'ios'
      ? isKeyboardVisible && keyboardHeight >= IOS_MIN_SOFTWARE_KEYBOARD_HEIGHT
      : isKeyboardVisible && keyboardHeight > 0;

  const enabled =
    enabledOverride === undefined ? autoEnabled : enabledOverride && autoEnabled;

  if (tabBarScene) {
    const rawLift =
      enabled && keyboardHeight > 0
        ? keyboardHeight + (Platform.OS === 'ios' ? IOS_TAB_SCENE_KEYBOARD_FUDGE : 0)
        : 0;
    /** Window-bottom overlap minus bottom safe inset — avoids double-counting with SafeAreaView. */
    const paddingBottom = Math.max(0, rawLift - insets.bottom);

    return (
      <View style={[style, paddingBottom > 0 && { paddingBottom }]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : undefined)}
      enabled={enabled}
      style={style}
      keyboardVerticalOffset={keyboardVerticalOffset}
      contentContainerStyle={contentContainerStyle}
      {...rest}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
