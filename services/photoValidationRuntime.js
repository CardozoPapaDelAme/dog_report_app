/**
 * @module services/photoValidationRuntime
 * Runtime wiring for on-device photo validation: Expo environment detection, lazy TFLite model loading,
 * pixel decoding and MobileNetV3 classification.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { createLazyModelLoader } from './lazyModelLoader.js';
import { classifyPhotoPixels } from './photoInference.js';
import { readPhotoPixels } from './photoPixels.js';
import { photoValidationAvailability } from './photoValidationAvailability.js';
import { createPhotoThresholds } from './photoThresholds.js';
import { photoThresholdsStorage } from './photoThresholdsStorage.js';
import { runPhotoValidationFlow } from './photoValidationFlow.js';

let errorLogged = false;

// Thresholds come from the active server configuration, cached for offline use; see services/photoThresholds.js.
const photoThresholds = createPhotoThresholds({ storage: photoThresholdsStorage });

// Lazy on purpose: Expo Go and web must never evaluate the native TFLite module
// or bundle path (same pattern as the MapLibre view in PublicMapScreen).
const modelLoader = createLazyModelLoader(() => {
  const { loadTensorflowModel } = require('react-native-fast-tflite');
  const { MOBILENET_V3_MODEL_ASSET } = require('../models/mobileNetV3Model.js');
  return loadTensorflowModel(MOBILENET_V3_MODEL_ASSET, []);
});

function logOnce(error) {
  if (errorLogged) return;
  errorLogged = true;
  console.warn('Photo validation unavailable, continuing without it:', error?.message ?? error);
}

// Returns {status:'accepted'|'rejected', ...} or {status:'skipped', reason}.
/**
 * @param {string} uri - Local photo URI.
 * @returns {Promise<import('./photoInference.js').PhotoClassification |
 *   import('./photoValidationFlow.js').SkippedPhotoValidation>} Never rejects.
 */
export function validateCapturedPhoto(uri) {
  const availability = photoValidationAvailability({
    executionEnvironment: Constants.executionEnvironment,
    platform: Platform.OS,
  });
  return runPhotoValidationFlow({
    uri,
    availability,
    onError: logOnce,
    getPixels: (photoUri) => readPhotoPixels(photoUri, require('expo-image-manipulator')),
    getThresholds: photoThresholds.get,
    loadModel: modelLoader.load,
    onModelFailure: modelLoader.reset,
    loadPendingMs: modelLoader.pendingSinceMs,
    classify: ({ model, pixels, thresholds }) => {
      const { MOBILENET_V3_LABELS, MOBILENET_V3_MODEL_METADATA } = require('../models/mobileNetV3Model.js');
      return classifyPhotoPixels({
        model,
        pixels,
        thresholds,
        labels: MOBILENET_V3_LABELS,
        modelVersion: `mobilenet_v3_small_100_224:${MOBILENET_V3_MODEL_METADATA.sha256.slice(0, 12).toLowerCase()}`,
      });
    },
  });
}
