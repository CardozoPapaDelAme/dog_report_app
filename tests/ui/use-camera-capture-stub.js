import { useRef, useState } from 'react';

function fixtureState() {
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  if (params.has('rejected')) return { phase: 'rejected', reasons: ['no_dog'], error: null };
  if (params.has('blurry')) return { phase: 'rejected', reasons: ['no_dog', 'blurry'], error: null };
  if (params.has('validating')) return { phase: 'validating', reasons: [], error: null };
  return { phase: 'idle', reasons: [], error: null };
}

export function useCameraCapture({ onPhotoAccepted } = {}) {
  const cameraRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  return {
    cameraRef,
    cameraReady,
    setCameraReady,
    // `?camera&rejected` / `&validating` render those feedback states in the web fixture.
    captureState: fixtureState(),
    clearFeedback() {},
    async capture() {
      onPhotoAccepted?.({
        photoUri: 'file:///private/ui-camera-stub.jpg',
        validation: { dogProbability: 0.95, blurVariance: 220 },
        validationSkipped: null,
      });
    },
  };
}
