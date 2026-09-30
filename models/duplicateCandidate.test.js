import { connectedSelection, groupDuplicateCandidates, readCandidateSnapshot, readDuplicateGroups, validateResolution, validateDuplicateNote } from './duplicateCandidate.js';
import { assertConnectedCandidates, validateDuplicateResolution } from '../supabase/functions/api/domain/duplicateGroup.js';
const id=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const snapshot={reports:[1,2,3,4,5].map((n)=>({id:id(n),status:'visible'})),candidates:[[1,2],[2,3],[4,5]].map(([a,b],i)=>({id:id(10+i),report_a:id(a),report_b:id(b),status:'pending'}))};
function assert(value){if(!value)throw new Error('Assertion failed');}
Deno.test('FAB-6 MODEL: exhaustive subsets match backend induced connectivity; no path through unselected nodes',()=>{
  for(let mask=0;mask<32;mask++){
    const ids=snapshot.reports.filter((_,i)=>mask&(1<<i)).map((r)=>r.id);
    let server=true;try{assertConnectedCandidates(ids,snapshot.candidates);}catch{server=false;}
    assert(connectedSelection(ids,snapshot.candidates)===server);
  }
  assert(connectedSelection([id(1),id(2),id(3)],snapshot.candidates));
  assert(!connectedSelection([id(1),id(3)],snapshot.candidates));
  assert(!connectedSelection([id(1),id(2)],snapshot.candidates.map((c)=>({...c,status:'confirmed'}))));
});
Deno.test('FAB-6 MODEL: components use actual suggestions and exclude active memberships',()=>{
  const components=groupDuplicateCandidates(snapshot);
  assert(components.length===2 && components[0].reports.length===3);
  assert(groupDuplicateCandidates(snapshot,[{report_ids:[id(2)]}]).length===1);
});
Deno.test('FAB-6 MODEL: canonical selection, count, note, membership and graph checked before payload',()=>{
  const selection={ids:[id(1),id(2),id(3)],canonicalId:id(2),note:' '};
  const valid=validateResolution(selection,snapshot);assert(valid.input && !('note' in valid.input));
  validateDuplicateResolution(valid.input);
  assert(validateResolution({...selection,ids:[id(1),id(3)]},snapshot).errors.report_ids.key==='disconnected');
  assert(validateResolution({...selection,canonicalId:id(4)},snapshot).errors.canonical_report_id);
  assert(validateResolution({...selection,ids:[id(1)]},snapshot).errors.report_ids);
  assert(validateResolution(selection,snapshot,[{report_ids:[id(1)]}]).errors.report_ids);
  assert(validateResolution({...selection,note:'x'.repeat(1001)},snapshot).errors.note);
  assert(validateDuplicateNote(' ') && !validateDuplicateNote('🐕'.repeat(1000)));
});
Deno.test('FAB-6 MODEL: malformed or incomplete graph never becomes an editable snapshot',()=>{
  assert(readCandidateSnapshot(snapshot).reports.length===5);
  for(const data of [null,{}, {...snapshot,reports:snapshot.reports.slice(1)},
    {...snapshot,candidates:[{...snapshot.candidates[0],status:'dismissed'}]},
    {...snapshot,reports:[...snapshot.reports,snapshot.reports[0]]}]) {
    let failed=false;try{readCandidateSnapshot(data);}catch(error){failed=error.code==='invalid_response';}assert(failed);
  }
  assert(readDuplicateGroups({duplicate_groups:[]}).length===0);
});
