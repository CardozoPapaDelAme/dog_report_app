import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isNativeMapAvailable } from './mapAvailability.js';

// Thin runtime wrapper; keep the logic in mapAvailability.js so it stays unit-testable.
export function isNativeMapAvailableAtRuntime() {
  return isNativeMapAvailable({ executionEnvironment: Constants.executionEnvironment, platform: Platform.OS });
}
