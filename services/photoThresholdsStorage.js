/**
 * @module services/photoThresholdsStorage
 * Native key/value storage for the cached photo thresholds, over `expo-secure-store`. The web variant
 * lives in `services/photoThresholdsStorage.web.js`.
 */
import * as SecureStore from 'expo-secure-store';

/** @type {{getItem: (key: string) => Promise<string | null>, setItem: (key: string, value: string) => Promise<void>}} */
export const photoThresholdsStorage = Object.freeze({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
});
