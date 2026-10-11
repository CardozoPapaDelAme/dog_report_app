/**
 * @module services/photoValidationAvailability
 * Pure runtime capability check for on-device TFLite photo validation.
 */
import { EXPO_GO_ENVIRONMENT } from './mapAvailability.js';

// Native TFLite only exists in development/standalone builds. Expo Go and web skip
// validation explicitly instead of pretending the photo was checked.
/**
 * @typedef {object} PhotoValidationAvailability
 * @property {boolean} available - Whether native validation can run.
 * @property {'web' | 'expo_go' | null} skipped - Why validation is skipped, or `null` when available.
 */
/**
 * @param {object} [options]
 * @param {string} [options.executionEnvironment] - `expo-constants` execution environment.
 * @param {string} [options.platform] - `Platform.OS`.
 * @returns {PhotoValidationAvailability}
 */
export function photoValidationAvailability({ executionEnvironment, platform } = {}) {
  if (platform === 'web') return { available: false, skipped: 'web' };
  if (executionEnvironment === EXPO_GO_ENVIRONMENT) return { available: false, skipped: 'expo_go' };
  return { available: true, skipped: null };
}
