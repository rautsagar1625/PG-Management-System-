'use strict';
// Bridge entry for expo/AppEntry.js in pnpm hoisted monorepo.
// Expo Go loads expo/AppEntry.js which does `import App from '../../App'`.
// With hoisting, that path resolves wrong, so metro.config.js redirects here.
// We replicate the setup expo-router/entry-classic would normally do.
require('@expo/metro-runtime');
require('expo-router/build/fast-refresh');
const { App } = require('expo-router/build/qualified-entry');
module.exports = App;
