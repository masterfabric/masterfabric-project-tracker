import { useSyncExternalStore } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardEvent,
  Platform,
} from 'react-native';

type KeyboardState = {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
};

let state: KeyboardState = {
  keyboardHeight: 0,
  isKeyboardVisible: false,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): KeyboardState {
  return state;
}

function emit() {
  listeners.forEach((l) => l());
}

function setKeyboardState(next: KeyboardState) {
  if (
    state.keyboardHeight === next.keyboardHeight &&
    state.isKeyboardVisible === next.isKeyboardVisible
  ) {
    return;
  }
  state = next;
  emit();
}

let didInitListeners = false;

function ensureGlobalKeyboardListeners() {
  if (didInitListeners) return;
  didInitListeners = true;

  const onHide = () => {
    setKeyboardState({ keyboardHeight: 0, isKeyboardVisible: false });
  };

  if (Platform.OS === 'ios') {
    /**
     * Single source of truth on iOS via frame updates. Hardware keyboard + accessory
     * bar often replaces the full software keyboard without hide+show; only these
     * events reflect the new height. Overlap = visible keyboard area at window bottom.
     * (We avoid pairing `keyboardWillHide` with `willChangeFrame` — order can briefly
     * resurrect a stale visible height mid-dismiss.)
     */
    const onFrame = (e: KeyboardEvent) => {
      const { screenY, height } = e.endCoordinates;
      const winH = Dimensions.get('window').height;
      const overlap = Math.max(0, Math.min(height, winH - screenY));
      if (overlap <= 0) {
        setKeyboardState({ keyboardHeight: 0, isKeyboardVisible: false });
      } else {
        setKeyboardState({ keyboardHeight: overlap, isKeyboardVisible: true });
      }
    };

    Keyboard.addListener('keyboardWillChangeFrame', onFrame);
    return;
  }

  const onShow = (e: KeyboardEvent) => {
    setKeyboardState({
      keyboardHeight: e.endCoordinates.height,
      isKeyboardVisible: true,
    });
  };

  Keyboard.addListener('keyboardDidShow', onShow);
  Keyboard.addListener('keyboardDidHide', onHide);
}

/**
 * Shared keyboard metrics (one native subscription per app). Safe to call from
 * multiple components — e.g. `AdaptiveKeyboardAvoidingView` + a screen that adjusts
 * composer padding when the keyboard is open.
 */
export function useKeyboard() {
  ensureGlobalKeyboardListeners();
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
