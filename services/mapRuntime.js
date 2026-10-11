/**
 * @module services/mapRuntime
 * Reads the Expo execution environment and platform to decide whether the native map can render.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isNativeMapAvailable } from './mapAvailability.js';

// Thin runtime wrapper; keep the logic in mapAvailability.js so it stays unit-testable.
/** @returns {boolean} Whether the native MapLibre view can be used in the current runtime. */
export function isNativeMapAvailableAtRuntime() {
  return isNativeMapAvailable({ executionEnvironment: Constants.executionEnvironment, platform: Platform.OS });
}
