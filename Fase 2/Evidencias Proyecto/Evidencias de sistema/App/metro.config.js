// Metro configuration compatible with React Native 0.72+
// Use 'expo/metro-config' and enable require.context
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable experimental require.context support
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

module.exports = config;