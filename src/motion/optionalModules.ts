import type { ComponentType } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Every native package this module can take advantage of is optional. The
 * effect degrades gracefully: without `expo-sensors` you still get
 * programmatic and manual tilt, and without `expo-blur` you still get the warp
 * and the darkening.
 *
 * Each `require` is a literal inside a `try`, which is what Metro's
 * `allowOptionalDependencies` (on by default in `@expo/metro-config`) looks
 * for: the bundle keeps building when the package is not installed, and the
 * `catch` runs instead. A computed `require(id)` would be rejected at build
 * time, so these cannot be folded into a helper.
 */
declare const require: (id: string) => any;

/** Subset of `expo-sensors`' `DeviceMotion` that the motion adapter uses. */
export interface DeviceMotionMeasurement {
  rotation?: { alpha: number; beta: number; gamma: number } | null;
  rotationRate?: { alpha: number; beta: number; gamma: number } | null;
  orientation?: number;
  interval?: number;
}

export interface DeviceMotionLike {
  isAvailableAsync(): Promise<boolean>;
  setUpdateInterval(intervalMs: number): void;
  addListener(listener: (measurement: DeviceMotionMeasurement) => void): { remove(): void };
  removeAllListeners?(): void;
  requestPermissionsAsync?(): Promise<{ granted: boolean }>;
}

export interface ExpoSensorsLike {
  DeviceMotion?: DeviceMotionLike;
}

/** Subset of `expo-blur`'s `BlurView` props that the overlay uses. */
export interface BlurViewProps {
  intensity?: number;
  tint?: string;
  /**
   * Android renders a plain translucent view unless a blur method is named, so
   * the overlay always passes one explicitly.
   */
  blurMethod?: 'none' | 'dimezisBlurView' | 'dimezisBlurViewSdk31Plus';
  blurReductionFactor?: number;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
  children?: React.ReactNode;
}

export interface ExpoLinearGradientProps {
  colors: readonly string[];
  locations?: readonly number[] | null;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
}

let sensorsCache: ExpoSensorsLike | null | undefined;
let blurCache: ComponentType<BlurViewProps> | null | undefined;
let gradientCache: ComponentType<ExpoLinearGradientProps> | null | undefined;

/** `expo-sensors`, or `null` when it is not installed. */
export function getExpoSensors(): ExpoSensorsLike | null {
  if (sensorsCache === undefined) {
    try {
      sensorsCache = require('expo-sensors') as ExpoSensorsLike;
    } catch {
      sensorsCache = null;
    }
  }
  return sensorsCache;
}

/** `expo-blur`'s `BlurView`, or `null` when it is not installed. */
export function getBlurView(): ComponentType<BlurViewProps> | null {
  if (blurCache === undefined) {
    try {
      blurCache =
        (require('expo-blur') as { BlurView?: ComponentType<BlurViewProps> }).BlurView ?? null;
    } catch {
      blurCache = null;
    }
  }
  return blurCache;
}

/** `expo-linear-gradient`'s `LinearGradient`, or `null` when it is not installed. */
export function getLinearGradient(): ComponentType<ExpoLinearGradientProps> | null {
  if (gradientCache === undefined) {
    try {
      gradientCache =
        (
          require('expo-linear-gradient') as {
            LinearGradient?: ComponentType<ExpoLinearGradientProps>;
          }
        ).LinearGradient ?? null;
    } catch {
      gradientCache = null;
    }
  }
  return gradientCache;
}

const warned = new Set<string>();

/** Logs a hint once per process, in development only. */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[iphone-duo-expo-rn] ${message}`);
}
