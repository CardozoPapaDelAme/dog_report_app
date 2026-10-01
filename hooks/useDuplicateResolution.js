import { useCallback, useEffect, useRef, useState } from 'react';
import * as duplicateApi from '../services/duplicateApi.js';
import { duplicateFieldErrors, groupDuplicateCandidates, validateDuplicateNote, validateResolution } from '../models/duplicateCandidate.js';
const empty = (token) => ({token,phase:token?'loading':'session',snapshot:{reports:[],candidates:[]},groups:[],
  ids:[],canonicalId:null,note:'',reverseId:null,reverseNote:'',errors:{},error:null,busy:null,needsReload:false,notice:null});

export function useDuplicateResolution(accessToken, api = duplicateApi) {
  const [state,setState] = useState(()=>empty(accessToken));
  const generation = useRef(0), lock = useRef(false), token = useRef(accessToken);
  token.current = accessToken;
  const visible = state.token === accessToken ? state : empty(accessToken);
  const current = (epoch) => generation.current === epoch && token.current === accessToken;
  const fetchState = useCallback(async () => {
    const [snapshot,groups] = await Promise.all([
      api.getDuplicateCandidates({accessToken}), api.getDuplicateGroups({accessToken}),
    ]);
    return {snapshot,groups};
  },[accessToken,api]);
  const load = useCallback(async () => {
    const epoch = ++generation.current;
    lock.current = true;
    setState(empty(accessToken));
    if (!accessToken) { lock.current=false; return; }
    try {
      const data = await fetchState();
      if (generation.current===epoch && token.current===accessToken) setState({...empty(accessToken),...data,phase:'ready'});
    } catch (error) {
      if (generation.current===epoch && token.current===accessToken) setState({...empty(accessToken),phase:error.status===401?'session':error.status===403?'forbidden':'error',error});
    } finally { if (generation.current===epoch && token.current===accessToken) lock.current=false; }
  },[accessToken,fetchState]);
  useEffect(()=>{load();return ()=>{generation.current++;lock.current=false;};},[load]);
  const components = groupDuplicateCandidates(visible.snapshot,visible.groups);
  const editable = !lock.current && visible.phase==='ready' && !visible.needsReload;
  function toggleReport(id) {
    if (!editable || visible.reverseId || !components.some((c)=>c.reports.some((r)=>r.id===id))) return;
    setState((previous)=>({...previous,ids:previous.ids.includes(id)?previous.ids.filter((value)=>value!==id):[...previous.ids,id],
      canonicalId:previous.canonicalId===id?null:previous.canonicalId,errors:{},error:null,notice:null}));
  }
  function chooseCanonical(id) {
    if (!editable || !visible.ids.includes(id)) return;
    setState((previous)=>({...previous,canonicalId:id,errors:{},error:null,notice:null}));
  }
  function changeNote(note) {
    if (editable) setState((previous)=>({...previous,note,errors:{},error:null}));
  }
  function openReverse(id) {
    if (!editable || !visible.groups.some((g)=>g.id===id)) return;
    setState((previous)=>({...previous,reverseId:id,reverseNote:'',errors:{},error:null}));
  }
  function closeReverse() {
    if (!lock.current) setState((previous)=>({...previous,reverseId:null,reverseNote:'',errors:{}}));
  }
  function changeReverseNote(reverseNote) {
    if (editable) setState((previous)=>({...previous,reverseNote,errors:{},error:null}));
  }
  async function mutate(kind) {
    if (!editable || (kind==='resolve' && visible.reverseId)) return;
    let input;
    if (kind==='resolve') {
      const result=validateResolution(visible,visible.snapshot,visible.groups);
      if (!result.input) {setState((previous)=>({...previous,errors:result.errors,error:null}));return;}
      input=result.input;
    } else {
      if (!visible.reverseId || !visible.groups.some((g)=>g.id===visible.reverseId)) return;
      const error=validateDuplicateNote(visible.reverseNote);
      if (error) {setState((previous)=>({...previous,errors:{note:error}}));return;}
      input={note:visible.reverseNote.trim()};
    }
    // Lock synchronously: successive taps before React renders send only one POST.
    if (lock.current) return;
    lock.current=true;
    const epoch=generation.current;
    let confirmed=false;
    setState((previous)=>({...previous,busy:kind,errors:{},error:null,notice:null}));
    try {
      const group=kind==='resolve'
        ? await api.resolveDuplicateGroup({accessToken,input})
        : await api.reverseDuplicateGroup({accessToken,groupId:visible.reverseId,input});
      if (!current(epoch)) return;
      confirmed=true;
      const notice={kind,groupId:group.id};
      setState((previous)=>({...previous,ids:[],canonicalId:null,note:'',reverseId:null,reverseNote:'',notice,busy:'refresh'}));
      // Re-read the actual graph, rather than fabricating candidates after reversal.
      const data=await fetchState();
      if (current(epoch)) setState({...empty(accessToken),...data,phase:'ready',notice});
    } catch (error) {
      if (!current(epoch)) return;
      if (error.status===401 || error.status===403) {
        setState({...empty(accessToken),phase:error.status===401?'session':'forbidden',error});
      } else {
        setState((previous)=>({...previous,busy:null,error,errors:duplicateFieldErrors(error),
          needsReload:confirmed || error.status!==400,
          // Close the confirmation after an uncertain command; only GET recovery
          // is offered, never a replay of the POST or an optimistic success.
          reverseId:error.status!==400 || confirmed?null:previous.reverseId,
        }));
      }
    } finally {if(current(epoch))lock.current=false;}
  }
  function reload() { if(!lock.current) return load(); }
  return {...visible,components,toggleReport,chooseCanonical,changeNote,openReverse,closeReverse,changeReverseNote,
    resolve:()=>mutate('resolve'),reverse:()=>mutate('reverse'),reload,
    selectionError:visible.ids.length>=2?validateResolution(visible,visible.snapshot,visible.groups).errors.report_ids:null,
    dirty:Boolean(visible.ids.length || visible.note || visible.reverseNote),
  };
}
