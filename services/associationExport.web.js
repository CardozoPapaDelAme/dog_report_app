/**
 * @param {object} options
 * @param {string} options.filename - Download file name.
 * @param {string} options.content - CSV text.
 * @returns {Promise<void>}
 */
/**
 * @module services/associationExport.web
 * Web adapter that downloads association exports through a temporary object URL.
 */
export async function saveAssociationCsv({ filename, content }) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * @param {object} options
 * @param {string} options.filename - Download file name.
 * @param {Uint8Array} options.content - XLSX bytes.
 * @returns {Promise<void>}
 */
export async function saveAssociationXlsx({ filename, content }) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
