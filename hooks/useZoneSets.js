import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyZoneDraft, prepareZoneText, readZoneSet, validateZoneApproval, validateZoneDraft, zoneFieldErrors } from '../models/zoneSet.js';
import { getConfiguration } from '../services/configurationApi.js';
import { activateZoneSet, createZoneSet } from '../services/zoneSetApi.js';
import { digestZone, pickZoneFile } from '../services/zoneFile';

const defaults = { getConfiguration, activateZoneSet, createZoneSet, digestZone, pickZoneFile };
const empty = (token) => ({ token, phase: token ? 'loading' : 'session', environment: null, active: null,
  draft: emptyZoneDraft(), preview: null, filename: '', saved: null, approval: '', busy: null,
  errors: {}, error: null, uncertain: null, verified: false });

export function useZoneSets(accessToken, dependencies = defaults) {
  const [state, setState] = useState(() => empty(accessToken));
  const generation = useRef(0);
  const lock = useRef(false);
  const token = useRef(accessToken);
  token.current = accessToken;
  const current = (epoch) => generation.current === epoch && token.current === accessToken;
  const visible = state.token === accessToken ? state : empty(accessToken);

  const load = useCallback(async () => {
    const epoch = ++generation.current;
    lock.current = true;
    setState(empty(accessToken));
    if (!accessToken) { lock.current = false; return; }
    try {
      const result = await dependencies.getConfiguration({ accessToken });
      const active = result.zone_set ? readZoneSet({ zone_set: result.zone_set }, { status: 'active', environment: result.configuration.environment }) : null;
      if (generation.current !== epoch || token.current !== accessToken) return;
      setState({ ...empty(accessToken), phase: 'ready', environment: result.configuration.environment, active });
    } catch (error) {
      if (generation.current !== epoch || token.current !== accessToken) return;
      setState({ ...empty(accessToken), phase: error.status === 401 ? 'session' : error.status === 403 ? 'forbidden' : 'error', error });
    } finally {
      if (generation.current === epoch && token.current === accessToken) lock.current = false;
    }
  }, [accessToken, dependencies]);
  useEffect(() => {
    load();
    return () => { generation.current++; lock.current = false; };
  }, [load]);

  function fail(error, operation) {
    if (error.status === 401 || error.status === 403) {
      setState({ ...empty(accessToken), phase: error.status === 401 ? 'session' : 'forbidden', error });
      return;
    }
    const errors = error.validationKey ? { content: { key: error.validationKey } } : zoneFieldErrors(error);
    setState((previous) => ({ ...previous, busy: null, errors, error,
      // A failed POST may have committed. No automatic replay; the active
      // projection can confirm activation, but cannot recover a lost draft id.
      uncertain: ['create', 'activate'].includes(operation) && error.status !== 400 ? operation : previous.uncertain,
    }));
  }
  function changeField(field, value) {
    if (lock.current || visible.phase !== 'ready' || visible.uncertain || visible.saved || !(field in visible.draft)) return;
    setState((previous) => ({ ...previous, draft: { ...previous.draft, [field]: value },
      preview: field === 'content' ? null : previous.preview, filename: field === 'content' ? '' : previous.filename,
      errors: {}, error: null,
    }));
  }
  async function prepare(fromFile = false) {
    if (lock.current || visible.phase !== 'ready' || visible.saved || visible.uncertain) return;
    lock.current = true;
    const epoch = generation.current;
    setState((previous) => ({ ...previous, busy: 'prepare', errors: {}, error: null }));
    try {
      const file = fromFile ? await dependencies.pickZoneFile() : { content: visible.draft.content, name: '' };
      if (!current(epoch)) return;
      if (!file) { setState((previous) => ({ ...previous, busy: null })); return; }
      // An invalid replacement must not leave the preceding valid checksum usable.
      setState((previous) => ({ ...previous, preview: null, filename: file.name, draft: { ...previous.draft, content: file.content } }));
      const preview = await prepareZoneText(file.content, dependencies.digestZone);
      if (current(epoch)) setState((previous) => ({ ...previous, preview, busy: null }));
    } catch (error) {
      if (current(epoch)) {
        setState((previous) => ({ ...previous, preview: null }));
        fail(error, 'prepare');
      }
    } finally { if (current(epoch)) lock.current = false; }
  }
  async function create() {
    if (lock.current || visible.phase !== 'ready' || visible.saved || visible.uncertain) return;
    const { input, errors } = validateZoneDraft(visible.draft, visible.preview);
    if (!input) { setState((previous) => ({ ...previous, errors, error: null })); return; }
    lock.current = true;
    const epoch = generation.current;
    setState((previous) => ({ ...previous, busy: 'create', errors: {}, error: null }));
    try {
      const saved = await dependencies.createZoneSet({ accessToken, input, environment: visible.environment });
      if (current(epoch)) setState((previous) => ({ ...previous, saved, approval: '', busy: null }));
    } catch (error) { if (current(epoch)) fail(error, 'create'); }
    finally { if (current(epoch)) lock.current = false; }
  }
  function changeApproval(approval) {
    if (lock.current || visible.uncertain || visible.saved?.status !== 'draft') return;
    setState((previous) => ({ ...previous, approval, errors: {}, error: null }));
  }
  async function activate() {
    if (lock.current || visible.phase !== 'ready' || visible.saved?.status !== 'draft' || visible.uncertain) return;
    const error = validateZoneApproval(visible.approval);
    if (error) { setState((previous) => ({ ...previous, errors: { association_approval_reference: error } })); return; }
    lock.current = true;
    const epoch = generation.current;
    setState((previous) => ({ ...previous, busy: 'activate', errors: {}, error: null }));
    try {
      const saved = await dependencies.activateZoneSet({ accessToken, id: visible.saved.id,
        checksum: visible.saved.source_sha256, environment: visible.environment,
        input: { association_approval_reference: visible.approval.trim() },
      });
      if (current(epoch)) setState((previous) => ({ ...previous, saved, active: saved, busy: null }));
    } catch (error) { if (current(epoch)) fail(error, 'activate'); }
    finally { if (current(epoch)) lock.current = false; }
  }
  async function verifyActivation() {
    if (lock.current || visible.uncertain !== 'activate') return;
    lock.current = true;
    const epoch = generation.current;
    setState((previous) => ({ ...previous, busy: 'verify', error: null, verified: false }));
    try {
      const result = await dependencies.getConfiguration({ accessToken });
      const active = result.zone_set ? readZoneSet({ zone_set: result.zone_set }, { status: 'active', environment: visible.environment }) : null;
      if (!current(epoch)) return;
      const confirmed = active?.id === visible.saved.id && active?.source_sha256 === visible.saved.source_sha256;
      setState((previous) => ({ ...previous, active, busy: null, verified: true,
        saved: confirmed ? active : previous.saved, uncertain: confirmed ? null : 'activate' }));
    } catch (error) { if (current(epoch)) fail(error, 'verify'); }
    finally { if (current(epoch)) lock.current = false; }
  }
  function startNew() {
    if (lock.current || visible.uncertain) return;
    setState((previous) => ({ ...empty(accessToken), phase: 'ready', environment: previous.environment, active: previous.active }));
  }
  return { ...visible, changeField, changeApproval, prepare, create, activate, verifyActivation, startNew, reload: load,
    dirty: Boolean(visible.saved?.status === 'draft' || visible.uncertain || (!visible.saved && Object.values(visible.draft).some(Boolean))),
  };
}
