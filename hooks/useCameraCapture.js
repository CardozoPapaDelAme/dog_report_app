import { useCallback, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

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
} = {}) {
  const cameraRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelStatus] = useState('preview');
  const [captureState, setCaptureState] = useState({
    phase: 'idle',
    rejection: null,
    error: null,
    validation: null,
  });

  const capture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || captureState.phase === 'capturing') {
      return null;
    }

    let capturedUri = null;
    setCaptureState({ phase: 'capturing', rejection: null, error: null, validation: null });

    try {
      const captured = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        shutterSound: false,
      });
      capturedUri = captured.uri;

      const photoUri = await persistValidatedPhoto(capturedUri);
      capturedUri = null;
      const accepted = { photoUri, validation: null, validationSkipped: 'expo_go' };
      setCaptureState({ phase: 'accepted', rejection: null, error: null, validation: null });
      onPhotoAccepted?.(accepted);
      return { accepted: true, ...accepted };
    } catch (error) {
      await deleteIfPossible(capturedUri);
      setCaptureState({
        phase: 'error',
        rejection: null,
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
