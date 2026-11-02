import type { Flow } from '../../shared';
import { useCallback, useEffect, useState } from 'react';

export const PLAYBACK_INTERVAL_MS = 2400;

/**
 * Step-through state for a request flow.
 * step = -1 means "not started" (no highlight); 0..n-1 is the active step.
 */
export function useFlowPlayback(flow: Flow | undefined) {
  const total = flow?.steps.length ?? 0;
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);

  // Restart whenever a different flow is selected.
  useEffect(() => {
    setStep(-1);
    setPlaying(false);
  }, [flow?.id]);

  useEffect(() => {
    if (!playing) return;
    if (step >= total - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, total - 1)), step === -1 ? 300 : PLAYBACK_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [playing, step, total]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, total - 1)), [total]);
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);
  const reset = useCallback(() => {
    setPlaying(false);
    setStep(-1);
  }, []);
  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      // Pressing play at the end starts over.
      if (!p && step >= total - 1) setStep(-1);
      return !p;
    });
  }, [step, total]);
  const goTo = useCallback((i: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(i, total - 1)));
  }, [total]);

  return { step, total, playing, next, prev, reset, togglePlay, goTo, activeStep: step >= 0 ? flow?.steps[step] : undefined };
}
