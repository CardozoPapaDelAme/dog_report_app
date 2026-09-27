import { useCallback, useEffect, useRef, useState } from 'react';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import jpeg from 'jpeg-js';

import {
  DEFAULT_PHOTO_VALIDATION_THRESHOLDS,
  IMAGE_SIZE,
  rgbaToModelInput,
  validatePhotoFrame,
} from '../models/photoValidation.js';
import {
  MOBILENET_V3_LABELS,
  MOBILENET_V3_MODEL_ASSET,
} from '../models/mobileNetV3Model.js';

const PHOTO_DIRECTORY = `${FileSystem.documentDirectory ?? ''}reports/photos/`;

async function loadTfliteModel(asset) {
  const { loadTensorflowModel } = require('react-native-fast-tflite');
  return loadTensorflowModel(asset, []);
}

function base64ToBytes(base64) {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  throw new Error('base64_decode_unavailable');
}

async function deleteIfPossible(uri) {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best-effort cleanup only. The local queue owns durable valid files later.
  }
}

async function ensurePhotoDirectory() {
  if (!PHOTO_DIRECTORY) throw new Error('document_directory_unavailable');
  await FileSystem.makeDirectoryAsync(PHOTO_DIRECTORY, { intermediates: true });
}

async function resizeForValidation(uri) {
  return manipulateAsync(
    uri,
    [{ resize: { width: IMAGE_SIZE, height: IMAGE_SIZE } }],
    { compress: 0.86, format: SaveFormat.JPEG, base64: true },
  );
}

async function persistValidatedPhoto(uri) {
  await ensurePhotoDirectory();
  const fileName = `report-photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const destination = `${PHOTO_DIRECTORY}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: destination });
  return destination;
}

function firstModelInputType(model) {
  const dataType = model?.inputs?.[0]?.dataType;
  if (dataType === 'float32' || dataType === 'int8') return dataType;
  return 'uint8';
}

export function useCameraCapture({
  onPhotoAccepted,
  thresholds = DEFAULT_PHOTO_VALIDATION_THRESHOLDS,
} = {}) {
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelStatus, setModelStatus] = useState(
    MOBILENET_V3_MODEL_ASSET ? 'loading' : 'missing',
  );
  const [captureState, setCaptureState] = useState({
    phase: 'idle',
    rejection: null,
    error: null,
    validation: null,
  });

  useEffect(() => {
    let mounted = true;
    if (!MOBILENET_V3_MODEL_ASSET) return undefined;

    setModelStatus('loading');
    loadTfliteModel(MOBILENET_V3_MODEL_ASSET)
      .then((model) => {
        if (!mounted) return;
        modelRef.current = model;
        setModelStatus('ready');
      })
      .catch(() => {
        if (!mounted) return;
        setModelStatus('error');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const capture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || captureState.phase === 'capturing') {
      return null;
    }
    if (!modelRef.current) {
      const code = modelStatus === 'missing' ? 'model_missing' : 'model_unavailable';
      setCaptureState({ phase: 'rejected', rejection: code, error: null, validation: null });
      return { accepted: false, reason: code };
    }

    let capturedUri = null;
    let validationUri = null;
    setCaptureState({ phase: 'capturing', rejection: null, error: null, validation: null });

    try {
      const captured = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      capturedUri = captured.uri;
      const prepared = await resizeForValidation(captured.uri);
      validationUri = prepared.uri;
      const bytes = base64ToBytes(prepared.base64);
      const decoded = jpeg.decode(bytes, { useTArray: true });
      const input = rgbaToModelInput(decoded.data, firstModelInputType(modelRef.current));
      const outputs = modelRef.current.runSync([input]);
      const validation = validatePhotoFrame({
        classifierOutput: outputs[0],
        rgba: decoded.data,
        width: decoded.width,
        height: decoded.height,
        labels: MOBILENET_V3_LABELS,
        thresholds,
      });

      if (!validation.passed) {
        await deleteIfPossible(validationUri);
        if (capturedUri !== validationUri) await deleteIfPossible(capturedUri);
        const rejection = validation.reasons.includes('no_dog') ? 'no_dog' : 'blurry';
        setCaptureState({ phase: 'rejected', rejection, error: null, validation });
        return { accepted: false, reason: rejection, validation };
      }

      const photoUri = await persistValidatedPhoto(validationUri);
      if (capturedUri !== validationUri) await deleteIfPossible(capturedUri);
      const accepted = { photoUri, validation };
      setCaptureState({ phase: 'accepted', rejection: null, error: null, validation });
      onPhotoAccepted?.(accepted);
      return { accepted: true, ...accepted };
    } catch (error) {
      await deleteIfPossible(validationUri);
      if (capturedUri !== validationUri) await deleteIfPossible(capturedUri);
      setCaptureState({
        phase: 'error',
        rejection: null,
        error: error?.message ?? 'capture_failed',
        validation: null,
      });
      return { accepted: false, reason: 'capture_failed', error };
    }
  }, [cameraReady, captureState.phase, modelStatus, onPhotoAccepted, thresholds]);

  const clearFeedback = useCallback(() => {
    setCaptureState((current) => ({
      ...current,
      phase: current.phase === 'capturing' ? current.phase : 'idle',
      rejection: null,
      error: null,
    }));
  }, []);

  return {
    cameraRef,
    cameraReady,
    setCameraReady,
    modelStatus,
    captureState,
    capture,
    clearFeedback,
  };
}
