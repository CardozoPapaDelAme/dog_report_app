/**
 * @module services/zoneFile
 * Native (iOS/Android) adapter to pick a GeoJSON zone file and hash zone text. The web build uses
 * `zoneFile.web.js` with the same exports.
 */
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { MAX_ZONE_FILE_BYTES, zoneValidation } from '../models/zoneSet.js';

/**
 * Hashes text with SHA-256.
 * @param {string} text
 * @returns {Promise<string>} Hex digest.
 */
export const digestZone = (text) => digestStringAsync(CryptoDigestAlgorithm.SHA256, text);
/**
 * Opens the document picker and reads the chosen file as text.
 * @returns {Promise<{name: string, content: string} | null>} `null` when the user cancels.
 * @throws {Error} `invalid_zone_file` with `validationKey: 'size'` when the file exceeds
 *   `MAX_ZONE_FILE_BYTES`; file system errors propagate.
 */
export async function pickZoneFile() {
  // Some providers label .geojson as octet-stream; validate the contents below.
  const result = await getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  if ((asset.size ?? file.size) > MAX_ZONE_FILE_BYTES) throw zoneValidation('size');
  return { name: asset.name, content: await file.text() };
}
