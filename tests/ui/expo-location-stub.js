// UI-test stand-in for expo-location: the real module needs the native Expo runtime.
// Permission is reported as denied so the map falls back to the Creel centre.
export const Accuracy = { Balanced: 3 };
export async function getForegroundPermissionsAsync() { return { granted: false, canAskAgain: false }; }
export async function requestForegroundPermissionsAsync() { return { granted: false, canAskAgain: false }; }
export async function getCurrentPositionAsync() { throw new Error('Location unavailable in UI tests'); }
