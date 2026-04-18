/**
 * Device registration service — conditions, validation, lifecycle.
 * Handles boot, splash, relaunch; validates before registering; keeps devices under user.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceInfoForAPI } from '../helpers/device-info';
import { useAppStore } from '../store/app-store';
import { useDeviceStore, type AppLifecyclePhase } from '../store/device-store';
import { mfGoDevice } from './mf-go-api';

const DEVICE_ID_KEY = '@mf_device_id';

/** All conditions that must be true to attempt device registration */
export interface DeviceRegistrationConditions {
  isAuthenticated: boolean;
  isAppReady: boolean;
  splashCompleted: boolean;
  isAppForeground: boolean;
}

/** Validates that all conditions are met */
export function areConditionsMet(conditions: DeviceRegistrationConditions): boolean {
  return (
    conditions.isAuthenticated &&
    conditions.isAppReady &&
    conditions.splashCompleted &&
    conditions.isAppForeground
  );
}

/** Validates device info before sending to API */
export function validateDeviceInfo(info: {
  deviceId?: string;
  platform?: string;
}): { valid: boolean; reason?: string } {
  if (!info.deviceId || info.deviceId.trim().length === 0) {
    return { valid: false, reason: 'deviceId required' };
  }
  if (!info.platform || !['ios', 'android', 'web'].includes(info.platform)) {
    return { valid: false, reason: 'platform must be ios, android, or web' };
  }
  return { valid: true };
}

export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    deviceId = `${timestamp}_${random}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Register device with mf-go. Validates conditions and device info first.
 * Updates device store on success.
 */
export async function registerDevice(phase: AppLifecyclePhase): Promise<boolean> {
  const deviceStore = useDeviceStore.getState();

  try {
    deviceStore.setRegistrationStatus('pending');
    deviceStore.setLastLifecyclePhase(phase);

    const [deviceId, deviceInfo] = await Promise.all([
      getOrCreateDeviceId(),
      getDeviceInfoForAPI(),
    ]);

    deviceStore.setCurrentDeviceId(deviceId);

    const validation = validateDeviceInfo({
      deviceId,
      platform: deviceInfo.device?.platform,
    });
    if (!validation.valid) {
      console.warn('[DeviceRegistration] Validation failed:', validation.reason);
      deviceStore.setRegistrationStatus('failed');
      return false;
    }

    await mfGoDevice.registerDevice({
      deviceId,
      platform: deviceInfo.device?.platform ?? '',
      deviceName: deviceInfo.device?.name ?? '',
      model: deviceInfo.device?.model ?? '',
      brand: deviceInfo.device?.brand ?? '',
      osName: deviceInfo.device?.os?.name ?? '',
      osVersion: deviceInfo.device?.os?.version ?? '',
      appName: deviceInfo.app?.name ?? '',
      appVersion: deviceInfo.app?.version ?? '',
      appBuild: deviceInfo.app?.build ?? '',
    });

    const userId = useAppStore.getState().user?.id ?? null;
    deviceStore.setLastRegisteredAt(Date.now());
    deviceStore.setLastRegisteredUserId(userId);
    deviceStore.setRegistrationStatus('registered');

    return true;
  } catch (error) {
    console.warn('[DeviceRegistration] Failed:', error);
    deviceStore.setRegistrationStatus('failed');
    return false;
  }
}

/** Fetch user's devices from mf-go (for validation) */
export async function fetchUserDevices(): Promise<void> {
  try {
    const devices = await mfGoDevice.myDevices();
    useDeviceStore.getState().setUserDevices(devices);
  } catch (error) {
    console.warn('[DeviceRegistration] Failed to fetch user devices:', error);
  }
}

/** Check if current device is in user's registered devices */
export function isCurrentDeviceRegistered(): boolean {
  const { currentDeviceId, userDevices } = useDeviceStore.getState();
  if (!currentDeviceId) return false;
  return userDevices.some((d) => d.deviceId === currentDeviceId);
}
