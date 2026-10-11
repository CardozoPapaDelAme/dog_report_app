/**
 * @module models/associationWorkbook
 * Builds the association XLSX export.
 */
import * as XLSX from 'xlsx';
import { ASSOCIATION_REPORT_COLUMNS, associationReportValues } from './associationReport.js';

/**
 * @param {import('./associationReport.js').AssociationReport[]} rows
 * @returns {Uint8Array} Workbook bytes with one `Reportes` sheet.
 */
export function createAssociationXlsx(rows) {
  const values = [ASSOCIATION_REPORT_COLUMNS, ...rows.map(associationReportValues)];
  const sheet = XLSX.utils.aoa_to_sheet(values);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Reportes');
  return new Uint8Array(XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true }));
}
