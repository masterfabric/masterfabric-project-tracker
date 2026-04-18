#!/usr/bin/env node
/**
 * Check that all i18n keys used in the codebase exist in en.json and tr.json.
 * Usage: node scripts/check-i18n-keys.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const EN_JSON = path.join(__dirname, '../src/shared/i18n/translations/en.json');
const TR_JSON = path.join(__dirname, '../src/shared/i18n/translations/tr.json');

function get(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

function extractKeysFromFile(content) {
  const keys = new Set();
  // Match t('key') or t("key") - including keys with interpolation like {{count}}
  const regex = /t\s*\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const fullKey = m[1];
    // Skip keys with interpolation - they're dynamic
    if (fullKey.includes('{{')) continue;
    // Only consider keys that look like i18n keys (contain dot for nested structure)
    if (!fullKey.includes('.')) continue; // Skip plain strings, test descriptions, etc.
    keys.add(fullKey);
  }
  return keys;
}

function walkDir(dir, ext, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') walkDir(fp, ext, callback);
    } else if (f.endsWith(ext)) {
      callback(fp);
    }
  }
}

function collectAllKeys() {
  const allKeys = new Set();
  walkDir(SRC_DIR, '.tsx', (fp) => {
    if (fp.includes('.test.') || fp.includes('.spec.') || fp.includes('__tests__')) return;
    const content = fs.readFileSync(fp, 'utf8');
    extractKeysFromFile(content).forEach((k) => allKeys.add(k));
  });
  walkDir(SRC_DIR, '.ts', (fp) => {
    // Skip test files and __tests__
    if (fp.includes('.test.') || fp.includes('.spec.') || fp.includes('__tests__')) return;
    const content = fs.readFileSync(fp, 'utf8');
    extractKeysFromFile(content).forEach((k) => allKeys.add(k));
  });
  return allKeys;
}

function main() {
  let en, tr;
  try {
    en = JSON.parse(fs.readFileSync(EN_JSON, 'utf8'));
  } catch (e) {
    console.error('Failed to parse en.json:', e.message);
    process.exit(1);
  }
  try {
    tr = JSON.parse(fs.readFileSync(TR_JSON, 'utf8'));
  } catch (e) {
    console.error('Failed to parse tr.json:', e.message);
    process.exit(1);
  }

  const keys = collectAllKeys();
  // Main app namespaces - focus on user-facing screens (exclude helper/dev screens)
  const mainAppPrefixes = ['settings.', 'auth.', 'common.', 'home.', 'profile.', 'notifications.', 'accessibility.', 'errors.', 'deviceInfo.', 'projects.', 'onboarding.', 'splash.', 'welcome.', 'greetings.'];
  const isMainAppKey = (k) => mainAppPrefixes.some((p) => k.startsWith(p));

  const missing = [];
  for (const key of keys) {
    const enVal = get(en, key);
    const trVal = get(tr, key);
    const enOk = enVal !== undefined && typeof enVal === 'string';
    const trOk = trVal !== undefined && typeof trVal === 'string';
    if (!enOk || !trOk) {
      missing.push({ key, en: enOk ? 'ok' : 'MISSING', tr: trOk ? 'ok' : 'MISSING', mainApp: isMainAppKey(key) });
    }
  }

  // Only fail on main app keys; warn about others
  const mainAppMissing = missing.filter((m) => m.mainApp);
  const otherMissing = missing.filter((m) => !m.mainApp);

  if (otherMissing.length > 0) {
    console.warn(`\nOther missing keys (helper screens, etc.): ${otherMissing.length}`);
  }

  if (mainAppMissing.length > 0) {
    console.error('\nMissing i18n keys (main app):\n');
    mainAppMissing.forEach(({ key, en: enStatus, tr: trStatus }) => {
      console.error(`  ${key}`);
      console.error(`    en: ${enStatus}, tr: ${trStatus}`);
    });
    process.exit(1);
  }
  console.log(`All ${keys.size} i18n keys checked. Main app keys present in en.json and tr.json.`);
}

main();
