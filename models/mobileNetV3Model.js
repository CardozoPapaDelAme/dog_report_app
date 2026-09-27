export const MOBILENET_V3_MODEL_ASSET = null;

export const MOBILENET_V3_LABELS = [];

// After downloading the exact Kaggle artifact, replace the two exports above with:
// export const MOBILENET_V3_MODEL_ASSET = require('./mobilenet_v3_small_100_224_int8.tflite');
// export const MOBILENET_V3_LABELS = ['full downloaded label 0', 'full downloaded label 1', ...];
export const MOBILENET_V3_MODEL_METADATA = Object.freeze({
  name: 'MobileNetV3-Small 100 224 classification INT8',
  expectedLocalFile: 'models/mobilenet_v3_small_100_224_int8.tflite',
  expectedLabelsFile: 'models/mobilenet_v3_small_100_224_labels.txt',
  kaggleUrl: 'https://www.kaggle.com/models/google/mobilenet-v3/TfLite/small-100-224-classification-metadata/1',
  kaggleDownloadUrl: 'https://www.kaggle.com/api/v1/models/google/mobilenet-v3/tfLite/small-100-224-classification-metadata/1/download',
  license: 'Apache-2.0 pending confirmation from downloaded Kaggle metadata',
  sha256: null,
  status: 'pending_download',
});
