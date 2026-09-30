// FAB-3 induced pending-candidate graph. No backend runtime in the mobile bundle.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const invalid = () => { throw Object.assign(new Error('Invalid duplicate response'), {code:'invalid_response'}); };
export function readCandidateSnapshot(data) {
  if (!Array.isArray(data?.reports) || !Array.isArray(data?.candidates)) invalid();
  const ids = new Set();
  for (const report of data.reports) {
    if (!UUID.test(report?.id) || ids.has(report.id) || !['visible','hidden','pending_review'].includes(report.status)) invalid();
    ids.add(report.id);
  }
  const edgeIds = new Set();
  for (const edge of data.candidates) {
    if (!UUID.test(edge?.id) || edgeIds.has(edge.id) || edge.status !== 'pending' ||
        edge.report_a === edge.report_b || !ids.has(edge.report_a) || !ids.has(edge.report_b)) invalid();
    edgeIds.add(edge.id);
  }
  return { reports: data.reports, candidates: data.candidates };
}
export function readDuplicateGroup(group, status = 'active') {
  if (!UUID.test(group?.id) || !UUID.test(group.canonical_report_id) || group.status !== status ||
      !Number.isInteger(group.resolution_version) || group.resolution_version < 1 ||
      !Array.isArray(group.report_ids) || !group.report_ids.length || !group.report_ids.every((id)=>UUID.test(id)) ||
      new Set(group.report_ids).size !== group.report_ids.length || !group.report_ids.includes(group.canonical_report_id)) invalid();
  // Retention can remove a noncanonical member; existing groups may have one survivor.
  return group;
}
export function readDuplicateGroups(data) {
  if (!Array.isArray(data?.duplicate_groups)) invalid();
  const groups = data.duplicate_groups.map((group)=>readDuplicateGroup(group));
  if (new Set(groups.map((g)=>g.id)).size !== groups.length) invalid();
  return groups;
}
function adjacencyFor(ids, candidates) {
  const map = new Map(ids.map((id)=>[id, new Set()]));
  for (const edge of candidates) {
    if (edge.status !== 'pending' || !map.has(edge.report_a) || !map.has(edge.report_b)) continue;
    map.get(edge.report_a).add(edge.report_b);
    map.get(edge.report_b).add(edge.report_a);
  }
  return map;
}
function visit(start, adjacency) {
  const seen = new Set(), stack = [start];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const neighbor of adjacency.get(id) ?? []) if (!seen.has(neighbor)) stack.push(neighbor);
  }
  return seen;
}
export function connectedSelection(ids, candidates) {
  return ids.length >= 2 && new Set(ids).size === ids.length && visit(ids[0], adjacencyFor(ids,candidates)).size === ids.length;
}
export function groupDuplicateCandidates(snapshot, activeGroups = []) {
  const occupied = new Set(activeGroups.flatMap((g)=>g.report_ids));
  const reports = snapshot.reports.filter((r)=>!occupied.has(r.id));
  const reportById = new Map(reports.map((r)=>[r.id,r]));
  const graph = adjacencyFor([...reportById.keys()],snapshot.candidates);
  const seen = new Set(), components = [];
  for (const report of reports) {
    if (seen.has(report.id) || !graph.get(report.id).size) continue;
    const ids = [...visit(report.id,graph)].sort();
    ids.forEach((id)=>seen.add(id));
    components.push({ id:ids[0], reports:ids.map((id)=>reportById.get(id)) });
  }
  return components.sort((a,b)=>a.id.localeCompare(b.id));
}
export function validateResolution({ ids, canonicalId, note }, snapshot, activeGroups = []) {
  const errors = {};
  if (ids.length < 2 || ids.length > 500 || new Set(ids).size !== ids.length) errors.report_ids = {key:'count'};
  else if (!ids.every((id)=>snapshot.reports.some((r)=>r.id===id && r.status!=='deleted')) ||
      activeGroups.some((g)=>g.report_ids.some((id)=>ids.includes(id)))) errors.report_ids = {key:'unavailable'};
  else if (!connectedSelection(ids,snapshot.candidates)) errors.report_ids = {key:'disconnected'};
  if (!ids.includes(canonicalId)) errors.canonical_report_id = {key:'canonical'};
  const noteError = validateDuplicateNote(note, false);
  if (noteError) errors.note = noteError;
  return { errors, input:Object.keys(errors).length ? null : {
    canonical_report_id:canonicalId, report_ids:[...ids].sort(), ...(note.trim() ? {note:note.trim()} : {}),
  } };
}
export function validateDuplicateNote(note, required = true) {
  return typeof note !== 'string' || (required && !note.trim()) || [...note.trim()].length > 1000 ? {key:'note'} : null;
}
export function duplicateFieldErrors(error) {
  const fields = error?.details?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
  return Object.fromEntries(Object.entries(fields).filter(([key,value])=>['canonical_report_id','report_ids','note'].includes(key) && typeof value==='string'));
}
