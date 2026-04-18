/**
 * App Config Service — fetches application base parameters from mf-go appSettings.
 * No auth required. Used for feature flags, app name, API URLs, etc.
 */

import { mfGoSettings } from './mf-go-api';
import type { AppSetting } from './mf-go-api';

export interface AppConfigParams {
  /** App display name from backend */
  appName: string;
  /** App version from backend (optional) */
  appVersion?: string;
  /** Feature flags as key-value */
  featureFlags: Record<string, boolean>;
  /** Custom config values by key */
  custom: Record<string, string>;
  /** Raw app settings for advanced use */
  raw: AppSetting[];
}

const DEFAULTS: AppConfigParams = {
  appName: 'MF Project Tracker',
  appVersion: '1.2.0',
  featureFlags: {},
  custom: {},
  raw: [],
};

let cachedConfig: AppConfigParams | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

function parseConfigFromSettings(settings: AppSetting[]): AppConfigParams {
  const featureFlags: Record<string, boolean> = {};
  const custom: Record<string, string> = {};
  let appName = DEFAULTS.appName;
  let appVersion = DEFAULTS.appVersion;

  for (const s of settings) {
    const key = s.key?.trim();
    const value = s.value?.trim();
    if (!key) continue;

    if (key === 'app_name' || key === 'appName') {
      appName = value || appName;
    } else if (key === 'app_version' || key === 'appVersion') {
      appVersion = value || appVersion;
    } else if (key.startsWith('feature_') || key.startsWith('feature.')) {
      const flagKey = key.replace(/^feature[_.]/, '');
      featureFlags[flagKey] = parseBool(value);
    } else {
      custom[key] = value ?? '';
    }
  }

  return {
    appName,
    appVersion,
    featureFlags,
    custom,
    raw: settings,
  };
}

/**
 * Fetch app config from mf-go appSettings. Cached for 5 minutes.
 */
export async function fetchAppConfig(): Promise<AppConfigParams> {
  const now = Date.now();
  if (cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const settings = await mfGoSettings.appSettings();
    cachedConfig = parseConfigFromSettings(settings);
    lastFetchTime = now;
    return cachedConfig;
  } catch (error) {
    console.warn('[AppConfig] Failed to fetch appSettings from mf-go:', error);
    return { ...DEFAULTS, raw: [] };
  }
}

/**
 * Invalidate cache (e.g. after app comes to foreground).
 */
export function invalidateAppConfigCache(): void {
  cachedConfig = null;
}

/**
 * Get a feature flag value.
 */
export function getFeatureFlag(config: AppConfigParams, key: string): boolean {
  return config.featureFlags[key] ?? false;
}

/**
 * Get a custom config value.
 */
export function getCustomConfig(config: AppConfigParams, key: string): string | undefined {
  return config.custom[key];
}
