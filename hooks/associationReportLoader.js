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
