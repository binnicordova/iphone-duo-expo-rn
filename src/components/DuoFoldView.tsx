import { useMemo, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { BlurLayer } from './BlurLayer';
import { DarkenLayer } from './DarkenLayer';
import {
  foldDarkenAlpha,
  solveFoldTransform,
  TILT_LIMIT_DEGREES,
  type FoldParameters,
} from '../core/foldGeometry';
import { clamp } from '../core/math';
import type { DuoFoldEngine } from '../motion/DuoFoldEngine';

/** Half the number of tilt samples baked into the interpolation tables. */
const TABLE_SAMPLES_PER_SIDE = 32;
/** Below this tilt range the effect is indistinguishable from nothing. */
const MIN_USEFUL_TILT_DEGREES = 0.5;

export interface DuoFoldViewProps {
  engine: DuoFoldEngine;
  parameters: FoldParameters;
  children?: ReactNode;
  enabled?: boolean;
  blurEnabled?: boolean;
  blurBands?: number;
  blurUpdateHz?: number;
  blurTint?: string;
  blurMethod?: 'none' | 'dimezisBlurView' | 'dimezisBlurViewSdk31Plus';
  missColor?: string;
  style?: React.ComponentProps<typeof View>['style'];
}

/**
 * Renders its children under the Duo fold.
 *
 * The layout is deliberately fixed: a clipping root, an outer layer carrying
 * the screen-space offset, an inner layer carrying the perspective projection,
 * and the blur and darkening overlays on top. The structure never changes with
 * the tilt — only interpolated style values do — so nothing below ever
 * re-mounts or re-renders because the device moved.
 */
export function DuoFoldView({
  engine,
  parameters,
  children,
  enabled = true,
  blurEnabled = true,
  blurBands = 28,
  blurUpdateHz = 30,
  blurTint = 'default',
  blurMethod = 'dimezisBlurViewSdk31Plus',
  missColor = '#000000',
  style,
}: DuoFoldViewProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const maxTilt = clamp(parameters.maxTiltDegrees, 0, TILT_LIMIT_DEGREES);
  const active = enabled && size.width > 1 && maxTilt >= MIN_USEFUL_TILT_DEGREES;

  const tables = useMemo(
    () => (active ? buildTables(engine.tilt, size.width, parameters, maxTilt) : null),
    [active, engine.tilt, size.width, parameters, maxTilt]
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
        ? current
        : { width, height }
    );
  };

  return (
    <View
      onLayout={onLayout}
      style={[styles.root, { backgroundColor: missColor }, style]}
      // The glass is a passive overlay; every touch belongs to the content.
      pointerEvents="box-none">
      <Animated.View
        pointerEvents="box-none"
        style={[styles.fill, tables ? { transform: [{ translateX: tables.translateX }] } : null]}>
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.fill,
            tables
              ? {
                  transform: [
                    { perspective: tables.perspective },
                    { rotateY: tables.rotateY },
                    { scaleX: tables.scaleX },
                    { scaleY: tables.scaleY },
                  ],
                }
              : null,
          ]}>
          {children}
        </Animated.View>
      </Animated.View>

      {tables && blurEnabled ? (
        <BlurLayer
          engine={engine}
          parameters={parameters}
          widthDp={size.width}
          bands={blurBands}
          updateHz={blurUpdateHz}
          tint={blurTint}
          blurMethod={blurMethod}
        />
      ) : null}

      {tables ? (
        <>
          {/* Hinge on the right edge: the frost spreads toward the left. */}
          <DarkenLayer darkEdge="left" opacity={tables.hingeRightDarken} color={missColor} />
          {/* Hinge on the left edge: the frost spreads toward the right. */}
          <DarkenLayer darkEdge="right" opacity={tables.hingeLeftDarken} color={missColor} />
        </>
      ) : null}
    </View>
  );
}

interface FoldTables {
  perspective: Animated.AnimatedInterpolation<number>;
  rotateY: Animated.AnimatedInterpolation<string>;
  scaleX: Animated.AnimatedInterpolation<number>;
  scaleY: Animated.AnimatedInterpolation<number>;
  translateX: Animated.AnimatedInterpolation<number>;
  hingeRightDarken: Animated.AnimatedInterpolation<number>;
  hingeLeftDarken: Animated.AnimatedInterpolation<number>;
}

/**
 * Bakes the closed-form solution into piecewise-linear interpolation tables.
 *
 * Every value the renderer needs is a smooth function of the signed tilt, so
 * sampling it once per layout lets one `Animated.Value` drive the whole fold:
 * a new tilt updates the views' native props directly, without re-rendering
 * anything or re-solving the geometry.
 */
function buildTables(
  tilt: Animated.Value,
  widthDp: number,
  parameters: FoldParameters,
  maxTilt: number
): FoldTables {
  const n = TABLE_SAMPLES_PER_SIDE;
  const inputRange: number[] = [];
  const perspective: number[] = [];
  const scaleX: number[] = [];
  const scaleY: number[] = [];
  const translateX: number[] = [];
  const hingeRightDarken: number[] = [];
  const hingeLeftDarken: number[] = [];

  for (let i = -n; i <= n; i++) {
    const degrees = (i / n) * maxTilt;
    const transform = solveFoldTransform(degrees, widthDp, parameters);
    inputRange.push(degrees);
    perspective.push(transform.perspective);
    scaleX.push(transform.scaleX);
    scaleY.push(transform.scaleY);
    translateX.push(transform.translateX);

    // The darkening is linear in the distance from the hinge, so one static
    // ramp per side scaled by its value at the far edge reproduces it exactly.
    const edgeAlpha = foldDarkenAlpha(widthDp, degrees, parameters);
    hingeRightDarken.push(degrees >= 0 ? edgeAlpha : 0);
    hingeLeftDarken.push(degrees <= 0 ? edgeAlpha : 0);
  }

  const table = (outputRange: number[]) =>
    tilt.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });

  return {
    perspective: table(perspective),
    scaleX: table(scaleX),
    scaleY: table(scaleY),
    translateX: table(translateX),
    hingeRightDarken: table(hingeRightDarken),
    hingeLeftDarken: table(hingeLeftDarken),
    // rotateY is exactly the negated tilt, so it needs no sampling.
    rotateY: tilt.interpolate({
      inputRange: [-maxTilt, maxTilt],
      outputRange: [`${maxTilt}deg`, `${-maxTilt}deg`],
      extrapolate: 'clamp',
    }),
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1 },
});
