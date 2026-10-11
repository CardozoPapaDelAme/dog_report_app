import { useRef, useState } from 'react';

export function useCameraCapture({ onPhotoAccepted } = {}) {
  const cameraRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  return {
    cameraRef,
    cameraReady,
    setCameraReady,
    captureState: { phase: 'idle', reasons: [], error: null },
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
