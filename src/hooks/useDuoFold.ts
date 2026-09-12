import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DuoFoldController, DuoFoldState } from '../DuoFold.types';
import { useDuoFoldContext } from '../components/context';

const MISSING_PROVIDER =
  'useDuoFold() must be called under a <DuoFoldProvider>. Wrap your app root ' +
  '(app/_layout.tsx with Expo Router) in one.';

/**
 * Imperative control over the fold: recalibrate, force a tilt, turn it off.
 *
 * The returned controller is stable and reading from it never re-renders, so
 * it is safe to grab from anywhere in the tree.
 *
 * ```tsx
 * const fold = useDuoFold();
 * <Button title="Recalibrate" onPress={fold.recalibrate} />
 * ```
 */
export function useDuoFold(): DuoFoldController {
  const context = useDuoFoldContext();
  if (!context) throw new Error(MISSING_PROVIDER);
  return context.engine;
}

/** Same as {@link useDuoFold}, but returns `null` instead of throwing. */
export function useOptionalDuoFold(): DuoFoldController | null {
  return useDuoFoldContext()?.engine ?? null;
}

/**
 * Subscribes to a slice of the fold state.
 *
 * The tilt updates at sensor rate, so a selector that returns it re-renders the
 * calling component just as often — pass `updateHz` to cap that. Selectors that
 * only read `hasSensor`, `source` or `enabled` re-render solely when those
 * change.
 */
export function useDuoFoldState<T>(selector: (state: DuoFoldState) => T, updateHz = 60): T {
  const context = useDuoFoldContext();
  if (!context) throw new Error(MISSING_PROVIDER);
  const { engine } = context;

  // The selector is read inside a sensor-rate callback, so it lives in a ref
  // that an effect keeps current — re-subscribing on every render would be far
  // more expensive than the indirection.
  const selectorRef = useRef(selector);
  useEffect(() => {
    selectorRef.current = selector;
  }, [selector]);

  const [value, setValue] = useState(() => selector(engine.getState()));
  const lastRef = useRef(0);

  useEffect(() => {
    const minIntervalMs = 1000 / Math.max(updateHz, 1);
    return engine.subscribe((state) => {
      const next = selectorRef.current(state);
      setValue((current) => {
        if (Object.is(current, next)) return current;
        const now = Date.now();
        if (now - lastRef.current < minIntervalMs) return current;
        lastRef.current = now;
        return next;
      });
    });
  }, [engine, updateHz]);

  return value;
}

/** The live tilt in degrees, sampled at `updateHz` (default 30). */
export function useDuoFoldTilt(updateHz = 30): number {
  const select = useCallback((state: DuoFoldState) => state.tiltDegrees, []);
  return useDuoFoldState(select, updateHz);
}

/** Whether a motion sensor is driving the fold, and which source is winning. */
export function useDuoFoldStatus(): Pick<DuoFoldState, 'hasSensor' | 'source' | 'enabled'> {
  const hasSensor = useDuoFoldState(selectHasSensor);
  const source = useDuoFoldState(selectSource);
  const enabled = useDuoFoldState(selectEnabled);
  return useMemo(() => ({ hasSensor, source, enabled }), [hasSensor, source, enabled]);
}

const selectHasSensor = (state: DuoFoldState) => state.hasSensor;
const selectSource = (state: DuoFoldState) => state.source;
const selectEnabled = (state: DuoFoldState) => state.enabled;
