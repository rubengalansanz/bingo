import type { ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config (plan-bingo §5.7).
 *
 * Two rules enforced here:
 *  - The app is offline-only: no network permissions, no analytics (§9.3).
 *    NOTE: `android.blockedPermissions: ['android.permission.INTERNET']` is NOT
 *    enabled yet on purpose: it would break the dev client (Metro) and EAS
 *    Update. It is a Phase 4 production-profile concern.
 *  - Orientation is locked to portrait on phones (§7.8).
 */

const BUNDLE_ID = 'com.bingobombo.app'; // TODO(phase-4): confirm before the first store upload.

const config: ExpoConfig = {
  name: 'Bingo',
  slug: 'bingo',
  scheme: 'bingo',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    requireFullScreen: false,
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#0E2A1E',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
