import React, { useEffect } from 'react';
import { View } from 'react-native';

export function CameraView({ facing: _facing, mode: _mode, zoom: _zoom, onCameraReady, ...props }) {
  useEffect(() => {
    onCameraReady?.();
  }, [onCameraReady]);
  return <View {...props} />;
}

export function useCameraPermissions() {
  // `?camera&no-permission` renders the permission screen in the web fixture.
  const denied = typeof location !== 'undefined' && new URLSearchParams(location.search).has('no-permission');
  return [{ granted: !denied }, async () => ({ granted: true })];
}
