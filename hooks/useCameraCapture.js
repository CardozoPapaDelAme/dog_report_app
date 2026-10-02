import { useCallback, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

import { validateCapturedPhoto } from '../services/photoValidationRuntime.js';

const PHOTO_DIRECTORY = `${FileSystem.documentDirectory ?? ''}reports/photos/`;

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

async function persistValidatedPhoto(uri) {
  await ensurePhotoDirectory();
  const fileName = `report-photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const destination = `${PHOTO_DIRECTORY}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: destination });
  return destination;
}

export function useCameraCapture({
  onPhotoAccepted,
  validatePhoto = validateCapturedPhoto,
} = {}) {
  const cameraRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelStatus] = useState('preview');
  const [captureState, setCaptureState] = useState({
    phase: 'idle',
    rejection: null,
    reasons: [],
    error: null,
    validation: null,
  });

  const capture = useCallback(async () => {
    if (
      !cameraRef.current
      || !cameraReady
      || captureState.phase === 'capturing'
      || captureState.phase === 'validating'
    ) {
      return null;
    }

    let capturedUri = null;
    setCaptureState({ phase: 'capturing', rejection: null, reasons: [], error: null, validation: null });

    try {
      const captured = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        shutterSound: false,
      });
      capturedUri = captured.uri;

      setCaptureState({ phase: 'validating', rejection: null, reasons: [], error: null, validation: null });
      const outcome = await validatePhoto(capturedUri);

      if (outcome.status === 'rejected') {
        await deleteIfPossible(capturedUri);
        capturedUri = null;
        setCaptureState({
          phase: 'rejected',
          rejection: outcome.reasons[0] ?? null,
          reasons: outcome.reasons,
          error: null,
          validation: outcome,
        });
        return { accepted: false, reason: 'validation_rejected', validation: outcome };
      }

      const skipped = outcome.status === 'skipped';
      const validation = skipped ? { status: 'skipped', reason: outcome.reason } : outcome;
      const photoUri = await persistValidatedPhoto(capturedUri);
      capturedUri = null;
      const accepted = {
        photoUri,
        validation,
        validationSkipped: skipped ? outcome.reason : null,
      };
      setCaptureState({ phase: 'accepted', rejection: null, reasons: [], error: null, validation });
      onPhotoAccepted?.(accepted);
      return { accepted: true, ...accepted };
    } catch (error) {
      await deleteIfPossible(capturedUri);
      setCaptureState({
        phase: 'error',
        rejection: null,
        reasons: [],
        error: error?.message ?? 'capture_failed',
        validation: null,
      });
      return { accepted: false, reason: 'capture_failed', error };
    }
  }, [cameraReady, captureState.phase, onPhotoAccepted]);

  const clearFeedback = useCallback(() => {
    setCaptureState((current) => ({
      ...current,
      phase: current.phase === 'capturing' ? current.phase : 'idle',
      rejection: null,
      reasons: [],
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
