import { checkZoneTextSize, normalizeZoneGeometry, prepareZoneText, validateZoneApproval, validateZoneDraft, readZoneSet } from './zoneSet.js';
import { canonicalZoneGeometry, sha256Hex, validateZoneSetCreation } from '../supabase/functions/api/domain/zoneSet.js';
const geometry = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] };
const draft = { name: 'Candidate', source_uri: 'https://example.test/zone.geojson', source_version: 'v1' };
const assert = (value) => { if (!value) throw new Error('Assertion failed'); };
Deno.test('FAB-5 MODEL: canonical hash matches FAB-2 regardless of whitespace and key order', async () => {
  const a = await prepareZoneText(JSON.stringify(geometry), sha256Hex);
  const b = await prepareZoneText(JSON.stringify({coordinates: geometry.coordinates, type: 'Polygon'}, null, 2), sha256Hex);
  assert(a.checksum === b.checksum);
  assert(a.checksum === await sha256Hex(canonicalZoneGeometry(geometry)));
  const c = await prepareZoneText(JSON.stringify(normalizeZoneGeometry(geometry)), sha256Hex);
  assert(c.checksum === a.checksum);
  const {input} = validateZoneDraft(draft, a);
  assert((await validateZoneSetCreation(input)).source_sha256 === a.checksum);
});
Deno.test('FAB-5 MODEL: rejects malformed JSON, unsupported wrappers, empty or invalid geometry', async () => {
  for (const value of ['', '{', '{}', JSON.stringify({...geometry, crs: {}}), JSON.stringify({type:'Feature', geometry}),
    JSON.stringify({type:'Polygon',coordinates:[]}), JSON.stringify({type:'MultiPolygon',coordinates:[]}),
    JSON.stringify({type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[2,0]]]}),
    JSON.stringify({type:'Polygon',coordinates:[[[0,0],[181,0],[1,1],[0,0]]]}),
    JSON.stringify({type:'Polygon',coordinates:[[[0,0],[1,0,3],[1,1],[0,0]]]})]) {
    let failed = false;
    try { await prepareZoneText(value, sha256Hex); } catch (error) { failed = error.code === 'invalid_zone_file'; }
    assert(failed);
  }
  let tooLarge = false;
  try { checkZoneTextSize('á'.repeat(524289)); } catch (error) { tooLarge = error.validationKey === 'size'; }
  assert(tooLarge);
});
Deno.test('FAB-5 MODEL: provenance and independent approval are mandatory and bounded', async () => {
  const preview = await prepareZoneText(JSON.stringify(geometry), sha256Hex);
  assert(validateZoneDraft(draft, null).errors.content);
  for (const field of ['name','source_uri','source_version']) {
    assert(validateZoneDraft({...draft, [field]: ' '}, preview).errors[field]);
    assert(validateZoneDraft({...draft, [field]: 'x'.repeat(1001)}, preview).errors[field]);
  }
  assert(validateZoneDraft({...draft, source_uri:'relative/file'}, preview).errors.source_uri);
  assert(validateZoneApproval(' ') && validateZoneApproval('x'.repeat(1001)));
  assert(!validateZoneApproval('🐕'.repeat(1000)));
  assert(!Object.hasOwn(validateZoneDraft(draft, preview).input, 'association_approval_reference'));
});
Deno.test('FAB-5 MODEL: never accepts wrong zone, hash, environment or lifecycle in a response', () => {
  const zone = {id:'00000000-0000-4000-8000-000000000001',version:1,environment:'staging',status:'draft',name:'Candidate',source_version:'v1',source_sha256:'a'.repeat(64)};
  assert(readZoneSet({zone_set:zone},{status:'draft'}) === zone);
  for (const expected of [{status:'active'},{id:'another'},{checksum:'b'.repeat(64)},{environment:'production'}]) {
    let failed = false;
    try { readZoneSet({zone_set:zone}, expected); } catch(error) { failed = error.code === 'invalid_response'; }
    assert(failed);
  }
});
