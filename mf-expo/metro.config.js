const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Ensure linked workspaces resolve modules from the app's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Explicitly map shared deps so Metro picks the app's copy
config.resolver.extraNodeModules = {
  firebase: path.resolve(projectRoot, 'node_modules/firebase'),
  '@react-native-async-storage/async-storage': path.resolve(projectRoot, 'node_modules/@react-native-async-storage/async-storage'),
  '@firebase-helper': path.resolve(projectRoot, 'src/screens/firebase-helper'),
  // Map masterfabric-expo-core to use source files directly in development
  'masterfabric-expo-core': path.resolve(projectRoot, 'packages/masterfabric-expo-core/src'),
};

// Custom resolver for masterfabric-expo-core to use source TypeScript files
// Also stub react-native-onesignal when running in Expo Go (EXPO_GO=1)
// Fix browser.js-like resolution: for web platform, ensure browser field is used
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'masterfabric-expo-core') {
    // Resolve to source index file directly
    const sourcePath = path.resolve(projectRoot, 'packages/masterfabric-expo-core/src/index.ts');
    return {
      filePath: sourcePath,
      type: 'sourceFile',
    };
  }
  // Always resolve through our shim — it picks Expo Go stub vs real `node_modules` at runtime
  // (`Constants.appOwnership === 'expo'` or web). Do NOT gate on EXPO_DEV_BUILD: plain `npm start`
  // + dev client must load the real SDK or push permission never appears.
  if (moduleName === 'react-native-onesignal') {
    const shimPath = path.resolve(projectRoot, 'src/shared/shims/react-native-onesignal.ts');
    return {
      filePath: shimPath,
      type: 'sourceFile',
    };
  }
  // For web platform: pass browser conditions so packages resolve browser-specific entry points
  // (fixes "Unable to resolve" / browser.js-like issues with deps that use package.json "browser" field)
  const resolveContext =
    platform === 'web'
      ? { ...context, unstable_conditionNames: ['browser', 'module', 'import', 'require'] }
      : context;
  if (originalResolveRequest) {
    return originalResolveRequest(resolveContext, moduleName, platform);
  }
  return context.resolveRequest(resolveContext, moduleName, platform);
};

// Support Firebase's .cjs files (required for React Native Firebase Auth)
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'cjs'];

// Disable package.json exports field to allow Metro to resolve Firebase modules correctly
config.resolver.unstable_enablePackageExports = false;

// Watch the monorepo packages folder
config.watchFolders = [
  path.resolve(projectRoot, 'packages'),
];

module.exports = config;


