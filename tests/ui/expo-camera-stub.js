import React, { useEffect } from 'react';
import { View } from 'react-native';

export function CameraView({ facing: _facing, mode: _mode, onCameraReady, ...props }) {
  useEffect(() => {
    onCameraReady?.();
  }, [onCameraReady]);
  return <View {...props} />;
}

export function useCameraPermissions() {
  return [{ granted: true }, async () => ({ granted: true })];
}
