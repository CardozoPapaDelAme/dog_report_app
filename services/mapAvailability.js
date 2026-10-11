/**
 * @module services/mapAvailability
 * Pure runtime capability check for the native MapLibre module.
 */
// Pure decision: the native MapLibre module only exists in development/standalone builds.
// Expo Go reports executionEnvironment 'storeClient' and cannot load it. Web uses the stub view.
export const EXPO_GO_ENVIRONMENT = 'storeClient';

/**
 * @param {object} [options]
 * @param {string} [options.executionEnvironment] - `expo-constants` execution environment.
 * @param {string} [options.platform] - `Platform.OS`.
 * @returns {boolean} `true` on web and outside Expo Go.
 */
export function isNativeMapAvailable({ executionEnvironment, platform } = {}) {
  if (platform === 'web') return true;
  return executionEnvironment !== EXPO_GO_ENVIRONMENT;
}
