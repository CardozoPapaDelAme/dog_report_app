import { EXPO_GO_ENVIRONMENT } from './mapAvailability.js';

// Native TFLite only exists in development/standalone builds. Expo Go and web skip
// validation explicitly instead of pretending the photo was checked.
export function photoValidationAvailability({ executionEnvironment, platform } = {}) {
  if (platform === 'web') return { available: false, skipped: 'web' };
  if (executionEnvironment === EXPO_GO_ENVIRONMENT) return { available: false, skipped: 'expo_go' };
  return { available: true, skipped: null };
}
