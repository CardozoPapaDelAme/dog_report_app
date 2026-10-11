/**
 * @module services/zoneFile.web
 * Web adapter to pick a GeoJSON zone file through a file input and hash zone text with Web Crypto.
 */
import { MAX_ZONE_FILE_BYTES, zoneValidation } from '../models/zoneSet.js';

/**
 * @param {string} text
 * @returns {Promise<string>} Lowercase hex SHA-256 digest of the UTF-8 text.
 */
export async function digestZone(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
/**
 * Opens a browser file dialog and reads the chosen file as text.
 * @returns {Promise<{name: string, content: string} | null>} `null` when cancelled or no file is chosen.
 * @throws {Error} Rejects with `invalid_zone_file` (`validationKey: 'size'`) when the file exceeds
 *   `MAX_ZONE_FILE_BYTES`, or with the read error.
 */
export function pickZoneFile() {
  // A separate web adapter keeps DOM and device file APIs out of each other's bundles.
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.geojson,.json,application/geo+json,application/json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        if (file.size > MAX_ZONE_FILE_BYTES) throw zoneValidation('size');
        resolve({ name: file.name, content: await file.text() });
      } catch (error) { reject(error); }
    };
    input.click();
  });
}
