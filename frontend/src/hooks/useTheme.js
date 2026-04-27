import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'theme';
const VALID_PREFS = ['light', 'dark', 'system'];
const CYCLE_NEXT = { light: 'dark', dark: 'system', system: 'light' };

function readPref() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID_PREFS.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(pref) {
  return pref === 'system' ? getSystemTheme() : pref;
}

/**
 * Reads/writes the user's theme preference from localStorage and resolves it
 * against the OS color scheme when set to "system". Keeps tabs in sync via the
 * storage event and reacts to OS-level changes when on "system".
 *
 * Returns:
 *   pref      — 'light' | 'dark' | 'system' (the user's stored choice)
 *   resolved  — 'light' | 'dark' (effective theme to render)
 *   setPref   — (value) => void
 *   cycle     — light -> dark -> system -> light
 */
export function useTheme() {
  const [pref, setPrefState] = useState(readPref);
  const [resolved, setResolved] = useState(() => resolve(readPref()));

  useEffect(() => {
    setResolved(resolve(pref));
    if (pref !== 'system') return undefined;
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setResolved(getSystemTheme());
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, [pref]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY) setPrefState(readPref());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setPref = useCallback((value) => {
    if (!VALID_PREFS.includes(value)) return;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore storage errors (private mode, quota)
    }
    setPrefState(value);
  }, []);

  const cycle = useCallback(() => {
    setPref(CYCLE_NEXT[pref] || 'system');
  }, [pref, setPref]);

  return { pref, resolved, setPref, cycle };
}

export const THEME_PREFS = VALID_PREFS;
