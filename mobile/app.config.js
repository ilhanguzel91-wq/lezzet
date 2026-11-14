// Fills Google Maps keys from environment variables (set them as EAS environment
// variables for cloud builds, or in your shell for local builds), so keys are not
// committed to the repository.
// For the single-page browser demo (EXPO_PUBLIC_DEMO=1) routes are bundled into one
// file so the page works wherever it is hosted.
const demo = process.env.EXPO_PUBLIC_DEMO === '1';
const name = (p) => (Array.isArray(p) ? p[0] : p);

module.exports = ({ config }) => ({
  ...config,
  plugins: config.plugins.map((p) => {
    if (name(p) === 'react-native-maps') {
      return [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
          iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
        },
      ];
    }
    if (demo && name(p) === 'expo-router') return ['expo-router', { asyncRoutes: false, sitemap: false }];
    return p;
  }),
});
