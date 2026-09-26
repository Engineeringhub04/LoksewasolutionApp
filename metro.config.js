// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Reduce Android/Termux inotify watcher usage.
// Do NOT block generic android/ios folders because some packages
// contain JS/TS files there that Metro must resolve.
const watchExclusions = [
  // React Native's large native source trees are not part of the JS graph.
  /node_modules\/react-native\/ReactAndroid\/.*/,
  /node_modules\/react-native\/ReactCommon\/.*/,
  /node_modules\/react-native\/ReactApple\/.*/,

  // Test/docs/example/build-only folders.
  /node_modules\/[^/]+\/(?:.*\/)?(__tests__|__mocks__|test|tests|docs?|examples?|\.github|\.circleci|\.gradle|Pods|coverage)\/.*/,

  // Project build/cache folders.
  /^(dist|\.expo|\.git)(\/.*)?$/,
];

config.resolver.blockList = watchExclusions.concat(
  config.resolver.blockList ?? []
);

module.exports = config;
