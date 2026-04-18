/**
 * Auth credentials storage — last email (convenience) and optional saved password.
 * Email stored in AsyncStorage; password in SecureStore when user opts in.
 * On logout: email is kept for pre-fill, password is cleared.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEY_LAST_EMAIL = 'mf-go-auth-last-email';
const KEY_SAVED_PASSWORD = 'mf-go-auth-saved-password';
const KEY_SAVED_EMAIL = 'mf-go-auth-saved-email';
const KEY_HAS_ASKED_SAVE_PASSWORD = 'mf-go-auth-has-asked-save-password';

export const authCredentials = {
  async getLastEmail(): Promise<string> {
    try {
      return (await AsyncStorage.getItem(KEY_LAST_EMAIL)) ?? '';
    } catch {
      return '';
    }
  },

  async setLastEmail(email: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_LAST_EMAIL, email.trim());
    } catch {
      // ignore
    }
  },

  async hasAskedSavePassword(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(KEY_HAS_ASKED_SAVE_PASSWORD)) === '1';
    } catch {
      return false;
    }
  },

  async setHasAskedSavePassword(): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_HAS_ASKED_SAVE_PASSWORD, '1');
    } catch {
      // ignore
    }
  },

  async getSavedPassword(email: string): Promise<string> {
    try {
      const storedEmail = await AsyncStorage.getItem(KEY_SAVED_EMAIL);
      if (storedEmail?.toLowerCase() !== email.trim().toLowerCase()) return '';
      return (await SecureStore.getItemAsync(KEY_SAVED_PASSWORD)) ?? '';
    } catch {
      return '';
    }
  },

  async setSavedPassword(email: string, password: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_SAVED_EMAIL, email.trim());
      await SecureStore.setItemAsync(KEY_SAVED_PASSWORD, password);
    } catch {
      // ignore
    }
  },

  async clearSavedPassword(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY_SAVED_EMAIL);
      await SecureStore.deleteItemAsync(KEY_SAVED_PASSWORD);
    } catch {
      // ignore
    }
  },
};
