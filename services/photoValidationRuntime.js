import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { createLazyModelLoader } from './lazyModelLoader.js';
import { classifyPhotoPixels } from './photoInference.js';
import { readPhotoPixels } from './photoPixels.js';
import { photoValidationAvailability } from './photoValidationAvailability.js';
import { runPhotoValidationFlow } from './photoValidationFlow.js';

let errorLogged = false;

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
    loadModel: modelLoader.load,
    onModelFailure: modelLoader.reset,
    classify: ({ model, pixels }) => {
      const { MOBILENET_V3_LABELS, MOBILENET_V3_MODEL_METADATA } = require('../models/mobileNetV3Model.js');
      return classifyPhotoPixels({
        model,
        pixels,
        labels: MOBILENET_V3_LABELS,
        modelVersion: `mobilenet_v3_small_100_224:${MOBILENET_V3_MODEL_METADATA.sha256.slice(0, 12).toLowerCase()}`,
      });
    },
  });
}
