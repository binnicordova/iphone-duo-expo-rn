import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { DuoFoldView } from './DuoFoldView';
import { DuoFoldContext, type DuoFoldContextValue } from './context';
import type { DuoFoldConfig } from '../DuoFold.types';
import { DEFAULT_FOLD_PARAMETERS, type FoldParameters } from '../core/foldGeometry';
import { DuoFoldEngine } from '../motion/DuoFoldEngine';

export interface DuoFoldProviderProps extends DuoFoldConfig {
  children?: ReactNode;
}

/**
 * Wraps an application in the Duo fold.
 *
 * Mount it once, as high in the tree as you can — in Expo Router that is the
 * root `app/_layout.tsx`, and in a plain Expo app it is whatever `App`
 * returns. It owns the sensor subscription, publishes the fold state on
 * context for {@link useDuoFold}, and renders its children under the effect.
 *
 * ```tsx
 * // app/_layout.tsx
 * import { DuoFoldProvider } from 'iphone-duo-expo-rn';
 * import { Stack } from 'expo-router';
 *
 * export default function RootLayout() {
 *   return (
 *     <DuoFoldProvider>
 *       <Stack />
 *     </DuoFoldProvider>
 *   );
 * }
 * ```
 */
export function DuoFoldProvider({
  children,
  parameters,
  motion,
  enabled = true,
  tiltSource = 'sensor',
  initialTiltDegrees = 0,
  updateIntervalMs = 16,
  blurBands = 28,
  blurUpdateHz = 30,
  blurEnabled = true,
  blurTint = 'default',
  blurMethod = 'dimezisBlurViewSdk31Plus',
  missColor = '#000000',
  style,
}: DuoFoldProviderProps) {
  // Memoized on the values rather than on the object, so the common
  // `parameters={{ ... }}` inline literal does not rebuild the renderer's
  // interpolation tables on every render.
  const merged = { ...DEFAULT_FOLD_PARAMETERS, ...parameters };
  const {
    eyeDistanceMillimeters,
    dpPerMillimeter,
    blurSpread,
    darkening,
    maxBlurRadiusDp,
    maxTiltDegrees,
  } = merged;
  const resolvedParameters = useMemo<FoldParameters>(
    () => ({
      eyeDistanceMillimeters,
      dpPerMillimeter,
      blurSpread,
      darkening,
      maxBlurRadiusDp,
      maxTiltDegrees,
    }),
    [
      eyeDistanceMillimeters,
      dpPerMillimeter,
      blurSpread,
      darkening,
      maxBlurRadiusDp,
      maxTiltDegrees,
    ]
  );

  // The engine outlives every re-render: recreating it would restart the
  // sensor and throw away the calibrated zero pose. Later changes to the
  // options below go through the engine's setters instead.
  const [engine] = useState(
    () =>
      new DuoFoldEngine({
        motion: { maxTiltDegrees: resolvedParameters.maxTiltDegrees, ...motion },
        tiltSource,
        initialTiltDegrees,
        updateIntervalMs,
        enabled,
      })
  );

  useEffect(() => {
    if (tiltSource !== 'sensor') return undefined;
    // Starting is async (availability and, on web, permission); the engine
    // reports the outcome through its state rather than by throwing.
    engine.start().catch(() => undefined);
    return () => engine.stop();
  }, [engine, tiltSource]);

  useEffect(() => () => engine.dispose(), [engine]);
  useEffect(() => engine.setUpdateInterval(updateIntervalMs), [engine, updateIntervalMs]);
  useEffect(() => engine.setEnabled(enabled), [engine, enabled]);

  const isEnabled = useEngineEnabled(engine, enabled);

  const contextValue = useMemo<DuoFoldContextValue>(
    () => ({ engine, parameters: resolvedParameters }),
    [engine, resolvedParameters]
  );

  return (
    <DuoFoldContext.Provider value={contextValue}>
      <DuoFoldView
        engine={engine}
        parameters={resolvedParameters}
        enabled={isEnabled}
        blurEnabled={blurEnabled}
        blurBands={blurBands}
        blurUpdateHz={blurUpdateHz}
        blurTint={blurTint}
        blurMethod={blurMethod}
        missColor={missColor}
        style={style}>
        {children}
      </DuoFoldView>
    </DuoFoldContext.Provider>
  );
}

/** Tracks `enabled` through the engine so `setEnabled()` also takes effect. */
function useEngineEnabled(engine: DuoFoldEngine, fallback: boolean): boolean {
  const [enabled, setEnabled] = useState(() => engine.getState().enabled);
  useEffect(
    () =>
      engine.subscribe((state) => {
        setEnabled((current) => (current === state.enabled ? current : state.enabled));
      }),
    [engine]
  );
  return enabled && fallback;
}
