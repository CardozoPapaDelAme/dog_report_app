// Native only: the .tflite is bundled via Metro (`tflite` is in assetExts).
// The .web.js sibling keeps the 10 MB model out of the web bundle.
export const MOBILENET_V3_MODEL_ASSET = require('./mobilenet_v3_small_100_224_int8.tflite');
