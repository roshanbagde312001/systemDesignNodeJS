import type { PaletteMode } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * "quick"  → only plain-English explanations, analogies and diagrams.
 * "deep"   → full technical detail.
 */
export type ReadingMode = 'quick' | 'deep';

interface Preferences {
  colorMode: PaletteMode;
  toggleColorMode: () => void;
  readingMode: ReadingMode;
  setReadingMode: (m: ReadingMode) => void;
}

const PreferencesContext = createContext<Preferences | null>(null);

// Browser storage can throw (private mode, blocked storage) — preferences must still work without it.
function load<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorMode] = useState<PaletteMode>(() => load('sda.colorMode', 'dark', ['dark', 'light'] as const));
  const [readingMode, setReadingModeState] = useState<ReadingMode>(() => load('sda.readingMode', 'deep', ['quick', 'deep'] as const));

  const toggleColorMode = useCallback(() => {
    setColorMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      save('sda.colorMode', next);
      return next;
    });
  }, []);

  const setReadingMode = useCallback((m: ReadingMode) => {
    save('sda.readingMode', m);
    setReadingModeState(m);
  }, []);

  const value = useMemo(() => ({ colorMode, toggleColorMode, readingMode, setReadingMode }), [colorMode, toggleColorMode, readingMode, setReadingMode]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
