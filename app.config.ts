import type { ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config (plan-bingo §5.7).
 *
 * Rules enforced here:
 *  - The app is offline-only: no network permissions, no analytics (§9.3).
 *    `blockedPermissions` is applied **only** to production builds: blocking
 *    INTERNET in a development build would break Metro and EAS Update, which
 *    is why the flag is gated by the build profile instead of shipped on.
 *  - Orientation is locked to portrait on phones (§7.8).
 *  - Audio is playback-only: no microphone, no recording permission and no
 *    background service, because the app only plays a bundled cue (§4.4).
 */

const BUNDLE_ID = 'com.bingobombo.app'; // TODO(phase-4): confirm before the first store upload.

/** `EAS_BUILD_PROFILE` is set by EAS Build; local prebuilds keep network. */
const IS_PRODUCTION_BUILD = process.env.EAS_BUILD_PROFILE === 'production';

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
    // Verifiable "no data leaves the device": the production APK cannot open a
    // socket at all (§9.3). Never set outside a production build.
    ...(IS_PRODUCTION_BUILD ? { blockedPermissions: ['android.permission.INTERNET'] } : undefined),
  },
  plugins: [
    'expo-router',
    [
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '48346552-cb08-4d2c-8b13-1bd638e140c3',
    },
  },
  updates: {
    url: 'https://u.expo.dev/48346552-cb08-4d2c-8b13-1bd638e140c3',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
};

export default config;
