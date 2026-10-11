/**
 * @module services/associationExport
 * Native adapter that writes association exports to the cache directory and opens the share sheet.
 * The web build uses `associationExport.web.js`.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * @param {object} options
 * @param {string} options.filename - File name inside the cache directory.
 * @param {string} options.content - CSV text.
 * @returns {Promise<void>}
 * @throws {Error} When sharing is unavailable on the device; file system errors propagate.
 */
export async function saveAssociationCsv({ filename, content }) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device');
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}

/**
 * @param {object} options
 * @param {string} options.filename - File name inside the cache directory.
 * @param {Uint8Array} options.content - XLSX bytes.
 * @returns {Promise<void>}
 * @throws {Error} When sharing is unavailable on the device; file system errors propagate.
 */
export async function saveAssociationXlsx({ filename, content }) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device');
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: 'org.openxmlformats.spreadsheetml.sheet' });
}
