import { useCallback, useEffect, useRef, useState } from 'react';
import { configurationFieldErrors, configurationIsDirty, configurationToDraft, validateConfigurationDraft } from '../models/configuration.js';
import * as configurationApi from '../services/configurationApi.js';

const empty = (token) => ({ token, phase: token ? 'loading' : 'session', configuration: null, zone: null, draft: {}, fieldErrors: {}, error: null, saving: false, savedVersion: null, needsReload: false });

export function useConfiguration(accessToken, api = configurationApi) {
  const [state, setState] = useState(() => empty(accessToken));
  const generation = useRef(0);
  const busy = useRef(false);
  const currentToken = useRef(accessToken);
  currentToken.current = accessToken;

  const load = useCallback(async () => {
    const version = ++generation.current;
    busy.current = false;
    setState(empty(accessToken));
    if (!accessToken) return;
    try {
      const result = await api.getConfiguration({ accessToken });
      if (generation.current !== version || currentToken.current !== accessToken) return;
      setState({ ...empty(accessToken), phase: 'ready', configuration: result.configuration, zone: result.zone_set, draft: configurationToDraft(result.configuration) });
    } catch (error) {
      if (generation.current !== version || currentToken.current !== accessToken) return;
      setState({ ...empty(accessToken), phase: error.status === 401 ? 'session' : error.status === 403 ? 'forbidden' : 'error', error });
    }
  }, [accessToken, api]);

  useEffect(() => {
    load();
    return () => { generation.current++; busy.current = false; };
  }, [load]);

  const visible = state.token === accessToken ? state : empty(accessToken);
  function changeField(field, value) {
    if (busy.current || visible.phase !== 'ready' || !(field in visible.draft)) return;
    setState((previous) => {
      const errors = { ...previous.fieldErrors };
      delete errors[field];
      if (field === 'trust_high_threshold') delete errors.trust_medium_threshold;
      return { ...previous, draft: { ...previous.draft, [field]: value }, fieldErrors: errors, savedVersion: null };
    });
  }
  async function save() {
    if (!accessToken || busy.current || visible.phase !== 'ready' || visible.needsReload) return false;
    const { payload, errors } = validateConfigurationDraft(visible.draft);
    if (!payload) {
      setState((previous) => ({ ...previous, fieldErrors: errors, error: null, savedVersion: null }));
      return false;
    }
    busy.current = true; // Synchronous gate: two taps before a render still produce one POST.
    const version = generation.current;
    setState((previous) => ({ ...previous, saving: true, fieldErrors: {}, error: null, savedVersion: null }));
    try {
      const result = await api.publishConfiguration({ accessToken, input: payload });
      if (generation.current !== version || currentToken.current !== accessToken) return false;
      setState({ ...empty(accessToken), phase: 'ready', configuration: result.configuration, zone: result.zone_set, draft: configurationToDraft(result.configuration), savedVersion: result.configuration.version });
      return true;
    } catch (error) {
      if (generation.current !== version || currentToken.current !== accessToken) return false;
      if (error.status === 401 || error.status === 403) {
        setState({ ...empty(accessToken), phase: error.status === 401 ? 'session' : 'forbidden', error });
      } else {
        // FAB-1 has no idempotency key. An uncertain POST must never be retried
        // automatically; read the active version before enabling another save.
        const needsReload = error.status !== 400;
        setState((previous) => ({ ...previous, saving: false, fieldErrors: configurationFieldErrors(error), error, needsReload }));
      }
      return false;
    } finally {
      if (generation.current === version && currentToken.current === accessToken) busy.current = false;
    }
  }
  return { ...visible, dirty: configurationIsDirty(visible.draft, visible.configuration), changeField, save, reload: load };
}
