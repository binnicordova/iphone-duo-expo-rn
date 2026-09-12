import type { StyleProp, ViewStyle } from 'react-native';

import type { FoldMotionOptions } from './core/FoldMotionModel';
import type { FoldParameters } from './core/foldGeometry';

export type { FoldParameters } from './core/foldGeometry';
export type { FoldTransform } from './core/foldGeometry';
export type { FoldMotionOptions, OrientationSample } from './core/FoldMotionModel';

/** Where the tilt that drives the fold comes from. */
export type DuoFoldTiltSource =
  /** Device motion sensors, falling back to `manual` when unavailable. */
  | 'sensor'
  /** Only whatever `setManualTilt` was last given. */
  | 'manual';

/** Live state of the fold, published by the controller. */
export interface DuoFoldState {
  /** Signed tilt in degrees. Positive = right edge farther from the viewer. */
  tiltDegrees: number;
  /** `+1` = hinge on the right edge, `-1` = hinge on the left edge. */
  hingeSide: 1 | -1;
  /** Whether a usable motion sensor was found and started. */
  hasSensor: boolean;
  /** Which source is actually driving `tiltDegrees` right now. */
  source: DuoFoldTiltSource;
  /** Whether the effect is currently rendering. */
  enabled: boolean;
}

/** Imperative handle returned by {@link useDuoFold}. */
export interface DuoFoldController {
  /** Current state; cheap to call, never triggers a render. */
  getState(): DuoFoldState;
  /** Subscribes to state changes. Returns an unsubscribe function. */
  subscribe(listener: (state: DuoFoldState) => void): () => void;
  /** Re-zeroes the pose at the device's current orientation. */
  recalibrate(): void;
  /**
   * Overrides the tilt with a fixed value, in degrees. Pass `null` to hand
   * control back to the sensors.
   */
  setManualTilt(degrees: number | null): void;
  /** Turns the effect on or off without unmounting the provider. */
  setEnabled(enabled: boolean): void;
  /** Toggles the slow washout that keeps the zero pose from drifting. */
  setAutoRecenterEnabled(enabled: boolean): void;
  /**
   * Asks for motion permission and restarts the sensor if it is granted.
   * Resolves to whether a sensor is running afterwards.
   *
   * Only the web needs this, and only from a user gesture. iOS and Android
   * start without it — and asking there prompts for a Motion & Fitness
   * permission this effect never uses.
   */
  requestPermissions(): Promise<boolean>;
}

/** Shared configuration for {@link DuoFoldProvider} and {@link DuoFoldView}. */
export interface DuoFoldConfig {
  /** Physical tuning of the fold. Merged over the defaults. */
  parameters?: Partial<FoldParameters>;
  /** Tuning of the sensor fusion. Merged over the defaults. */
  motion?: FoldMotionOptions;
  /** Renders children untouched when `false`. Defaults to `true`. */
  enabled?: boolean;
  /** Where the tilt comes from. Defaults to `'sensor'`. */
  tiltSource?: DuoFoldTiltSource;
  /** Starting tilt in degrees, used before the first sample and in manual mode. */
  initialTiltDegrees?: number;
  /** Sensor sampling interval in milliseconds. Defaults to `16`. */
  updateIntervalMs?: number;
  /**
   * How many blurred bands approximate the shader's per-pixel, gap-proportional
   * blur. Each band is one more view, but too few leaves visible seams where
   * the blur steps. Defaults to `28`.
   */
  blurBands?: number;
  /**
   * How often (Hz) the blur bands re-render. The geometry and the darkening
   * follow the tilt without rendering at all; blur is low-frequency enough
   * that a slower cadence is invisible and much cheaper. Defaults to `30`.
   */
  blurUpdateHz?: number;
  /** Disables the blur layer entirely, keeping only the warp and the darkening. */
  blurEnabled?: boolean;
  /** `expo-blur` tint for the frosted strips. Defaults to `'default'`. */
  blurTint?: string;
  /**
   * Android blur backend. `'none'` makes `expo-blur` fall back to a plain
   * translucent view there, so the default picks the real blur on SDK 31+.
   */
  blurMethod?: 'none' | 'dimezisBlurView' | 'dimezisBlurViewSdk31Plus';
  /**
   * Colour the glass absorbs toward, and what shows where the projected ray
   * misses the UI plane entirely — black in the reference. Defaults to
   * `'#000000'`.
   */
  missColor?: string;
  /** Style applied to the clipping root. */
  style?: StyleProp<ViewStyle>;
}
