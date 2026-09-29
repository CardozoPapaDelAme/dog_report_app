import { MAX_ZONE_FILE_BYTES, zoneValidation } from '../models/zoneSet.js';

export async function digestZone(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
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
