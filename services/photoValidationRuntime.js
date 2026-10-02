import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { classifyPhotoPixels } from './photoInference.js';
import { readPhotoPixels } from './photoPixels.js';
import { photoValidationAvailability } from './photoValidationAvailability.js';
import { runPhotoValidationFlow } from './photoValidationFlow.js';

let modelPromise = null;
let errorLogged = false;

// Lazy on purpose: Expo Go and web must never evaluate the native TFLite module
// or bundle path (same pattern as the MapLibre view in PublicMapScreen).
function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const { loadTensorflowModel } = require('react-native-fast-tflite');
      const { MOBILENET_V3_MODEL_ASSET } = require('../models/mobileNetV3Model.js');
      return loadTensorflowModel(MOBILENET_V3_MODEL_ASSET, []);
    })();
    modelPromise.catch(() => { modelPromise = null; });
  }
  return modelPromise;
}

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
    loadModel,
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
