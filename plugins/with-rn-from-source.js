const { withPodfileProperties } = require('@expo/config-plugins');

// Ensures ios/Podfile.properties.json always contains
// "ios.buildReactNativeFromSource": "true" after expo prebuild,
// even on EAS (which excludes the ios/ directory via .easignore and
// regenerates Podfile.properties.json from scratch on every build).
// Without this, the react-native+0.83.4.patch never compiles because
// EAS uses the pre-built React.framework instead of building from source.
module.exports = (config) =>
  withPodfileProperties(config, (c) => {
    c.modResults['ios.buildReactNativeFromSource'] = 'true';
    return c;
  });
