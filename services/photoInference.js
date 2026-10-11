/**
 * @module services/photoInference
 * Runs the MobileNetV3 TFLite classifier on decoded photo pixels and applies the dog/blur decision from
 * `models/photoValidation.js`.
 */
import {
  IMAGE_SIZE,
  DEFAULT_PHOTO_VALIDATION_THRESHOLDS,
  rgbaToModelInput,
  validatePhotoFrame,
} from '../models/photoValidation.js';
import { rgbToRgba } from './photoPixels.js';

/** Tensor data types supported for the model input. */
const INPUT_TYPES = new Set(['uint8', 'int8', 'float32']);

/** Wraps an output buffer in the typed array for `dataType`; throws `unsupported_output_type:<type>`. */
function outputView(buffer, dataType) {
  if (dataType === 'float32') return new Float32Array(buffer);
  if (dataType === 'uint8') return new Uint8Array(buffer);
  if (dataType === 'int8') return new Int8Array(buffer);
  throw new Error(`unsupported_output_type:${dataType}`);
}

// Runs the classifier on 224x224 RGB pixels and applies the dog/blur decision.
// `model` is a react-native-fast-tflite TfliteModel (inputs/outputs/run).
/**
 * @typedef {object} PhotoClassification
 * @property {'accepted' | 'rejected'} status
 * @property {string[]} reasons - Rejection reasons from `validatePhotoFrame`.
 * @property {number} dogProbability
 * @property {number} blurScore - Laplacian variance.
 * @property {string} modelVersion
 */
/**
 * @param {object} options
 * @param {object} options.model - `react-native-fast-tflite` model.
 * @param {{width: number, height: number, rgb: Uint8Array}} options.pixels - 224x224 RGB pixels.
 * @param {string[]} options.labels - Classifier labels.
 * @param {string} options.modelVersion - Recorded in the result.
 * @param {object} [options.thresholds] - Defaults to `DEFAULT_PHOTO_VALIDATION_THRESHOLDS`.
 * @returns {Promise<PhotoClassification>}
 * @throws {Error} `unexpected_pixel_size`, `unsupported_input_type:<type>`, `unexpected_model_input_shape`,
 *   `unsupported_output_type:<type>`, or a model runtime error.
 */
export async function classifyPhotoPixels({
  model,
  pixels,
  labels,
  modelVersion,
  thresholds = DEFAULT_PHOTO_VALIDATION_THRESHOLDS,
}) {
  if (pixels.width !== IMAGE_SIZE || pixels.height !== IMAGE_SIZE) {
    throw new Error('unexpected_pixel_size');
  }
  const inputTensor = model.inputs[0];
  const outputTensor = model.outputs[0];
  if (!INPUT_TYPES.has(inputTensor.dataType)) {
    throw new Error(`unsupported_input_type:${inputTensor.dataType}`);
  }
  if (inputTensor.shape.join(',') !== `1,${IMAGE_SIZE},${IMAGE_SIZE},3`) {
    throw new Error('unexpected_model_input_shape');
  }

  const rgba = rgbToRgba(pixels.rgb);
  const input = rgbaToModelInput(rgba, inputTensor.dataType);
  const outputs = await model.run([input.buffer]);
  const classifierOutput = outputView(outputs[0], outputTensor.dataType);

  const frame = validatePhotoFrame({
    classifierOutput,
    rgba,
    width: pixels.width,
    height: pixels.height,
    labels,
    thresholds,
  });
  return {
    status: frame.passed ? 'accepted' : 'rejected',
    reasons: frame.reasons,
    dogProbability: frame.dogProbability,
    blurScore: frame.blurVariance,
    modelVersion,
  };
}
