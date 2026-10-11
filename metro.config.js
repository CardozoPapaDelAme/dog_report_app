/**
 * Metro bundler configuration for the Expo app.
 *
 * Extends the Expo default config so `.wasm` and `.tflite` files are bundled as
 * assets. Loaded automatically by Metro/Expo (`expo start`, `expo run:*`).
 *
 * @module metro.config
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm', 'tflite');

module.exports = config;
