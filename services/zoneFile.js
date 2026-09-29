import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { MAX_ZONE_FILE_BYTES, zoneValidation } from '../models/zoneSet.js';

export const digestZone = (text) => digestStringAsync(CryptoDigestAlgorithm.SHA256, text);
export async function pickZoneFile() {
  // Some providers label .geojson as octet-stream; validate the contents below.
  const result = await getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  if ((asset.size ?? file.size) > MAX_ZONE_FILE_BYTES) throw zoneValidation('size');
  return { name: asset.name, content: await file.text() };
}
