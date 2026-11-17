import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Loads `path` from the API; re-runs when the path changes. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(path);
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (id === seq.current) setState((s) => ({ ...s, error: e.message, loading: false }));
    }
  }, [path]);

  useEffect(() => { load(); }, [load]);

  const mutate = useCallback((fn) => setState((s) => ({ ...s, data: fn(s.data) })), []);
  return { ...state, reload: load, mutate };
}

/** Short-lived message at the bottom of the screen. */
export function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setMsg(text);
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [msg, show];
}
