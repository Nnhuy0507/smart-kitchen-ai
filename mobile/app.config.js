// Keep a static Bundle ID fallback: EAS may evaluate config without .env.local.
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const configuredBundleId = process.env.IOS_BUNDLE_IDENTIFIER?.trim();
  const bundleIdentifier = configuredBundleId && !configuredBundleId.startsWith('YOUR_')
    ? configuredBundleId
    : config.ios?.bundleIdentifier;
  const plugins = [...(config.plugins || [])];
  if (!plugins.includes("expo-web-browser")) {
    plugins.push("expo-web-browser");
  }
  if (process.env.EAS_BUILD_PLATFORM === 'ios' && (!iosClientId || iosClientId.startsWith('YOUR_'))) {
    throw new Error('Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID before building the iOS app.');
  }
  if (iosClientId && !iosClientId.startsWith('YOUR_')) {
    if (!iosClientId.endsWith('.apps.googleusercontent.com')) {
      throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be an iOS OAuth Client ID.');
    }
    if (!bundleIdentifier || bundleIdentifier.startsWith('YOUR_')) {
      throw new Error('Set IOS_BUNDLE_IDENTIFIER to the Bundle ID registered in your Google iOS OAuth client.');
    }
    plugins.push(['@react-native-google-signin/google-signin', {
      iosUrlScheme: `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`,
    }]);
  }
  return {
    ...config,
    ios: { ...config.ios, ...(bundleIdentifier && !bundleIdentifier.startsWith('YOUR_') ? { bundleIdentifier } : {}) },
    plugins,
  };
};
