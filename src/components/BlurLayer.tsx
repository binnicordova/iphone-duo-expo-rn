import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { foldBlurStrength, type FoldParameters } from '../core/foldGeometry';
import type { DuoFoldEngine } from '../motion/DuoFoldEngine';
import { getBlurView, warnOnce } from '../motion/optionalModules';

/** Resolved once at import time; `expo-blur` is an optional dependency. */
const BlurView = getBlurView();

export interface BlurLayerProps {
  engine: DuoFoldEngine;
  parameters: FoldParameters;
  widthDp: number;
  /** Number of vertical bands that approximate the continuous blur ramp. */
  bands: number;
  /** How often the bands re-evaluate their intensity, in Hz. */
  updateHz: number;
  /** `expo-blur` tint for the strips. */
  tint: string;
  /** Android blur backend; `'none'` there means no blur at all. */
  blurMethod: 'none' | 'dimezisBlurView' | 'dimezisBlurViewSdk31Plus';
}

/**
 * Approximation of the shader's gap-proportional disk blur.
 *
 * The shader blurs per pixel with a radius that grows with the distance from
 * the hinge. React Native has no per-pixel blur that can read the content
 * behind it, so the ramp is quantised into `bands` backdrop-blurred strips.
 * Blur is a low-frequency cue, so the strips re-render at `updateHz` rather
 * than at sensor rate — the only part of the effect that costs a React render
 * at all, since the geometry and the darkening ride the animated tilt value.
 */
export const BlurLayer = memo(function BlurLayer({
  engine,
  parameters,
  widthDp,
  bands,
  updateHz,
  tint,
  blurMethod,
}: BlurLayerProps) {
  const tiltDegrees = useThrottledTilt(engine, updateHz);

  if (!BlurView) {
    warnOnce(
      'expo-blur',
      'expo-blur is not installed, so the fold renders without its frosted blur. ' +
        'Run `npx expo install expo-blur` for the full effect, or pass ' +
        'blurEnabled={false} to silence this.'
    );
    return null;
  }

  // At rest there is nothing to blur, and unmounting the strips keeps the
  // common case free of backdrop-blur work entirely.
  if (Math.abs(tiltDegrees) < 0.25 || !(widthDp > 1)) return null;

  const count = Math.max(1, Math.round(bands));
  const bandWidth = widthDp / count;
  const hingeX = tiltDegrees >= 0 ? widthDp : 0;
  const strips = [];

  for (let i = 0; i < count; i++) {
    const centerX = (i + 0.5) * bandWidth;
    const strength = foldBlurStrength(Math.abs(centerX - hingeX), tiltDegrees, parameters);
    // `expo-blur` treats intensity as a 1-100 scale, so anything that would
    // round to nothing is better left unmounted.
    if (strength * 100 < 1) continue;
    strips.push(
      <BlurView
        key={i}
        pointerEvents="none"
        intensity={strength * 100}
        tint={tint}
        blurMethod={blurMethod}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: i * bandWidth,
          // A hairline of overlap keeps sub-pixel seams from showing between
          // strips without double-blurring anything meaningful.
          width: bandWidth + 0.5,
        }}
      />
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {strips}
    </View>
  );
});

/** Samples the engine's tilt at a capped rate, to keep the strips cheap. */
function useThrottledTilt(engine: DuoFoldEngine, updateHz: number): number {
  const [tiltDegrees, setTiltDegrees] = useState(() => engine.getState().tiltDegrees);
  const lastRef = useRef(0);

  useEffect(() => {
    const minIntervalMs = 1000 / Math.max(updateHz, 1);
    return engine.subscribe((state) => {
      const now = Date.now();
      if (now - lastRef.current < minIntervalMs) return;
      lastRef.current = now;
      setTiltDegrees(state.tiltDegrees);
    });
  }, [engine, updateHz]);

  return tiltDegrees;
}
