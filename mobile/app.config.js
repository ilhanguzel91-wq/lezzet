// Fills Google Maps keys from environment variables (set them as EAS environment
// variables for cloud builds, or in your shell for local builds), so keys are not
// committed to the repository.
module.exports = ({ config }) => ({
  ...config,
  plugins: config.plugins.map((p) =>
    (Array.isArray(p) ? p[0] : p) === 'react-native-maps'
      ? [
          'react-native-maps',
          {
            androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
            iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
          },
        ]
      : p,
  ),
});
