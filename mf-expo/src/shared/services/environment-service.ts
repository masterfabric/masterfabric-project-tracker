/**
 * Runtime environment switcher: Dev (localhost), Prod (live backend), or Custom GraphQL URL.
 * URLs come from local.env (gitignored) via app.config extra. Custom URLs persist in AsyncStorage.
 *
 * Dev URL notes:
 * - iOS Simulator: localhost reaches the host Mac (mf-go on :8080).
 * - Android emulator: localhost is the emulator; we rewrite to 10.0.2.2 so the host Mac is reachable.
 * - Physical device: localhost is the phone itself — set EXPO_PUBLIC_DEV_GRAPHQL_URL to your Mac's LAN IP
 *   (e.g. http://192.168.1.10:8080/graphql) or use Custom URL in the in-app switcher.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const STORAGE_KEY = '@graphql_environment';
const STORAGE_KEY_CUSTOM_URL = '@graphql_custom_graphql_url';
const STORAGE_KEY_HISTORY = '@graphql_custom_graphql_history';
const HISTORY_MAX = 20;

export type GraphQLEnvironment = 'dev' | 'prod' | 'custom';

/** Dev URL from build config / env before Android-emulator rewrite (for UI hints). */
function getDevGraphQLUrlConfigured(): string {
  const fromExtra = Constants.expoConfig?.extra?.devGraphqlUrl;
  if (fromExtra && typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  return process.env.EXPO_PUBLIC_DEV_GRAPHQL_URL || 'http://localhost:8080/graphql';
}

/** On Android emulator only, map localhost → host loopback (10.0.2.2). */
function rewriteLocalhostForAndroidEmulator(url: string): string {
  if (Platform.OS !== 'android' || Constants.isDevice === true) return url;
  const lower = url.toLowerCase();
  if (!lower.includes('localhost') && !lower.includes('127.0.0.1')) return url;
  return url.replace(/127\.0\.0\.1/g, '10.0.2.2').replace(/localhost/gi, '10.0.2.2');
}

function getDevGraphQLUrl(): string {
  return rewriteLocalhostForAndroidEmulator(getDevGraphQLUrlConfigured());
}

/**
 * Active GraphQL URL uses loopback while running on a physical device — requests will fail.
 * Use your computer's LAN IP in `local.env` or the in-app Custom URL field.
 */
export function isLoopbackGraphQLUrlOnPhysicalDevice(): boolean {
  if (Constants.isDevice !== true) return false;
  try {
    const u = getGraphQLUrl().toLowerCase();
    return (
      (u.includes('localhost') || u.includes('127.0.0.1')) && !u.includes('10.0.2.2')
    );
  } catch {
    return false;
  }
}

/** Show under the Dev card: configured dev endpoint still uses loopback on a real phone. */
export function shouldShowDevLoopbackOnDeviceHint(): boolean {
  if (Constants.isDevice !== true) return false;
  const u = getDevGraphQLUrlConfigured().toLowerCase();
  return u.includes('localhost') || u.includes('127.0.0.1');
}

function getProdGraphQLUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.graphqlUrl;
  if (fromExtra && typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  return process.env.EXPO_PUBLIC_GRAPHQL_URL || '';
}

let currentEnv: GraphQLEnvironment = 'prod';
let prodUrl: string = getProdGraphQLUrl();
/** Active endpoint when {@link currentEnv} is `custom` */
let customGraphqlUrl: string = '';

let historyCache: string[] | null = null;

/**
 * Normalize user input into a full http(s) GraphQL endpoint.
 * Host-only input gets path `/graphql`. Existing paths are kept as-is.
 */
export function normalizeGraphqlEndpoint(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    let urlStr = trimmed;
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = `https://${urlStr}`;
    }
    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const path = u.pathname.replace(/\/$/, '');
    if (path === '' || path === '/') {
      u.pathname = '/graphql';
    }
    let out = u.toString();
    if (out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    return null;
  }
}

function readHistoryParsed(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

async function persistHistory(list: string[]): Promise<void> {
  historyCache = list;
  await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(list));
}

/** URLs recently used for custom backend (most recent first). */
export async function getCustomUrlHistory(): Promise<string[]> {
  if (historyCache) return historyCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
    historyCache = readHistoryParsed(raw);
    return historyCache;
  } catch {
    historyCache = [];
    return historyCache;
  }
}

function bumpHistory(list: string[], url: string): string[] {
  const next = [url, ...list.filter((u) => u !== url)];
  return next.slice(0, HISTORY_MAX);
}

/** Remove one entry from custom URL history. */
export async function removeCustomUrlFromHistory(url: string): Promise<void> {
  const list = await getCustomUrlHistory();
  await persistHistory(list.filter((u) => u !== url));
}

/** Clear all custom URL history (does not change current environment). */
export async function clearCustomUrlHistory(): Promise<void> {
  await persistHistory([]);
}

/** Get current GraphQL URL based on selected environment */
export function getGraphQLUrl(): string {
  if (currentEnv === 'dev') return getDevGraphQLUrl();
  if (currentEnv === 'custom' && customGraphqlUrl) return customGraphqlUrl;
  return prodUrl || getDevGraphQLUrl();
}

/** Current mode (dev / prod / custom). */
export function getEnvironment(): GraphQLEnvironment {
  return currentEnv;
}

/** Last saved custom endpoint (for prefill), or empty when none. */
export function getCustomGraphqlUrl(): string {
  return customGraphqlUrl;
}

/** Get both built-in URLs for display */
export function getEnvironmentUrls(): { dev: string; prod: string } {
  return { dev: getDevGraphQLUrl(), prod: prodUrl };
}

/**
 * Set dev or prod and persist. Does not clear custom URL memory (used when reopening the sheet).
 * Call {@link resetGraphQLClient} after to apply.
 */
export async function setEnvironment(env: Exclude<GraphQLEnvironment, 'custom'>): Promise<void> {
  if (currentEnv === env) return;
  currentEnv = env;
  await AsyncStorage.setItem(STORAGE_KEY, env);
}

/**
 * Validate URL, switch to custom mode, persist, and append to history.
 * Call {@link resetGraphQLClient} and {@link resetUserMessageSubscriptionClient} after to apply.
 */
export async function applyCustomGraphqlUrl(raw: string): Promise<
  { ok: true; url: string } | { ok: false; reason: 'invalid' }
> {
  const url = normalizeGraphqlEndpoint(raw);
  if (!url) return { ok: false, reason: 'invalid' };
  currentEnv = 'custom';
  customGraphqlUrl = url;
  await AsyncStorage.multiSet([
    [STORAGE_KEY, 'custom'],
    [STORAGE_KEY_CUSTOM_URL, url],
  ]);
  const history = await getCustomUrlHistory();
  await persistHistory(bumpHistory(history, url));
  return { ok: true, url };
}

/** Load persisted environment on app init */
export async function loadEnvironment(): Promise<GraphQLEnvironment> {
  try {
    prodUrl = getProdGraphQLUrl();
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'dev' || stored === 'prod') {
      currentEnv = stored;
      customGraphqlUrl = (await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_URL))?.trim() ?? '';
    } else if (stored === 'custom') {
      const url = (await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_URL))?.trim() ?? '';
      if (url) {
        currentEnv = 'custom';
        customGraphqlUrl = url;
      } else {
        currentEnv = 'prod';
        await AsyncStorage.setItem(STORAGE_KEY, 'prod');
      }
    }
    await getCustomUrlHistory();
    return currentEnv;
  } catch {
    return currentEnv;
  }
}
