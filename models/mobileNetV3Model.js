import labels from './mobilenet_v3_small_100_224_labels.json';
import { MOBILENET_V3_MODEL_ASSET } from './mobileNetV3Asset';

export { MOBILENET_V3_MODEL_ASSET };

export const MOBILENET_V3_LABELS = labels;

export const MOBILENET_V3_MODEL_METADATA = Object.freeze({
  name: 'MobileNetV3-Small 100 224 classification INT8',
  expectedLocalFile: 'models/mobilenet_v3_small_100_224_int8.tflite',
  expectedLabelsFile: 'models/mobilenet_v3_small_100_224_labels.txt',
  kaggleUrl: 'https://www.kaggle.com/models/google/mobilenet-v3/TfLite/small-100-224-classification-metadata/1',
  kaggleDownloadUrl: 'https://www.kaggle.com/api/v1/models/google/mobilenet-v3/tfLite/small-100-224-classification-metadata/1/download',
  license: 'Apache-2.0',
  sha256: '77C98343789C066287E1A5E85314428F47BD4302F053C920CE00A46D90CB1388',
  status: 'available_for_development_build',
  labels: {
    count: labels.length,
    dogRange: { start: 152, end: 269 },
  },
});
