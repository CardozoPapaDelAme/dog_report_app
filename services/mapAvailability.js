// Pure decision: the native MapLibre module only exists in development/standalone builds.
// Expo Go reports executionEnvironment 'storeClient' and cannot load it. Web uses the stub view.
export const EXPO_GO_ENVIRONMENT = 'storeClient';

export function isNativeMapAvailable({ executionEnvironment, platform } = {}) {
  if (platform === 'web') return true;
  return executionEnvironment !== EXPO_GO_ENVIRONMENT;
}
