// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The proot/Termux environment has a tight inotify watch budget. Metro's
// file watcher walks every directory it hasn't blocked, so we keep it away
// from native/build/test folders that are never part of the JS import graph.
const watchExclusions = [
  // Native source trees inside packages (Metro only resolves JS, never these).
  /node_modules\/[^/]+\/(?:.*\/)?(android|ios|windows|macos)\/.*/,
  // Test suites, docs, examples, and CI/build tooling shipped inside packages.
  /node_modules\/[^/]+\/(?:.*\/)?(__tests__|__mocks__|test|tests|docs?|examples?|\.github|\.circleci|\.gradle|Pods|coverage)\/.*/,
  // Project build artifacts that aren't source input (root-only; many
  // node_modules packages ship their real entry point inside their own dist/).
  /^(dist|\.expo|\.git)(\/.*)?$/,
];

config.resolver.blockList = watchExclusions.concat(config.resolver.blockList ?? []);

module.exports = config;
