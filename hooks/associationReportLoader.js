/**
 * @module hooks/associationReportLoader
 * Loads every page of association reports for one date range, guarding against repeated ids and
 * cursor loops.
 */
/**
 * @param {object} options
 * @param {string} options.accessToken - Session access token.
 * @param {{from: string, to: string}} options.range - ISO instants from `validateAssociationDateRange`.
 * @param {(query: {accessToken: string, from: string, to: string, cursor: string | null}) =>
 *   Promise<import('../models/associationReport.js').AssociationReportPage>} options.getPage - Page request.
 * @returns {Promise<import('../models/associationReport.js').AssociationReport[]>} All rows, in page order.
 * @throws {Error} `invalid_response` when a report id or a cursor repeats; request errors propagate.
 */
export async function loadAssociationReportRange({ accessToken, range, getPage }) {
  const items = [];
  const ids = new Set();
  const cursors = new Set();
  let cursor = null;
  do {
    const page = await getPage({ accessToken, ...range, cursor });
    for (const item of page.items) {
      if (ids.has(item.id)) {
        throw Object.assign(new Error('Repeated association report across pages'), { code: 'invalid_response' });
      }
      ids.add(item.id);
      items.push(item);
    }
    cursor = page.next_cursor;
    if (cursor && cursors.has(cursor)) {
      throw Object.assign(new Error('Repeated association report cursor'), { code: 'invalid_response' });
    }
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return items;
}
