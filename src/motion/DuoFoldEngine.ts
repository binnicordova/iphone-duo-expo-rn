import { Animated, Platform } from 'react-native';

import { getExpoSensors, warnOnce, type DeviceMotionMeasurement } from './optionalModules';
import type { DuoFoldController, DuoFoldState, DuoFoldTiltSource } from '../DuoFold.types';
import { FoldMotionModel, type FoldMotionOptions } from '../core/FoldMotionModel';
import { clamp, DEG_TO_RAD } from '../core/math';
import { Store } from '../core/store';

export interface DuoFoldEngineOptions {
  motion?: FoldMotionOptions;
  tiltSource?: DuoFoldTiltSource;
  initialTiltDegrees?: number;
  updateIntervalMs?: number;
  enabled?: boolean;
  maxTiltDegrees?: number;
}

/**
 * Owns the sensor subscription, the fusion model and the animated tilt value.
 *
 * The tilt is published twice: as an `Animated.Value` the renderer interpolates
 * its whole style from, and through a {@link Store} that UI code can subscribe
 * to. Neither path re-renders the wrapped application.
 */
export class DuoFoldEngine implements DuoFoldController {
  /** Signed tilt in degrees; the renderer's single animated input. */
  readonly tilt: Animated.Value;
  readonly store: Store<DuoFoldState>;

  private readonly model: FoldMotionModel;
  private readonly maxTiltDegrees: number;
  private updateIntervalMs: number;
  private subscription: { remove(): void } | null = null;
  private manualTilt: number | null = null;
  private started = false;
  private disposed = false;

  constructor(options: DuoFoldEngineOptions = {}) {
    this.maxTiltDegrees = options.motion?.maxTiltDegrees ?? options.maxTiltDegrees ?? 45;
    this.model = new FoldMotionModel({ maxTiltDegrees: this.maxTiltDegrees, ...options.motion });
    this.updateIntervalMs = options.updateIntervalMs ?? 16;

    const source: DuoFoldTiltSource = options.tiltSource ?? 'sensor';
    const initial = clamp(
      options.initialTiltDegrees ?? 0,
      -this.maxTiltDegrees,
      this.maxTiltDegrees
    );
    if (source === 'manual') this.manualTilt = initial;

    this.tilt = new Animated.Value(initial);
    this.store = new Store<DuoFoldState>({
      tiltDegrees: initial,
      hingeSide: initial >= 0 ? 1 : -1,
      hasSensor: false,
      source,
      enabled: options.enabled ?? true,
    });
  }

  getState(): DuoFoldState {
    return this.store.get();
  }

  subscribe(listener: (state: DuoFoldState) => void): () => void {
    return this.store.subscribe(listener);
  }

  recalibrate(): void {
    this.model.recalibrate();
    if (this.manualTilt !== null) this.manualTilt = 0;
    this.publish(0);
  }

  setManualTilt(degrees: number | null): void {
    if (degrees === null) {
      this.manualTilt = null;
      this.store.patch({ source: this.store.get().hasSensor ? 'sensor' : 'manual' });
      return;
    }
    this.manualTilt = clamp(degrees, -this.maxTiltDegrees, this.maxTiltDegrees);
    this.store.patch({ source: 'manual' });
    this.publish(this.manualTilt);
  }

  setEnabled(enabled: boolean): void {
    this.store.patch({ enabled });
  }

  setAutoRecenterEnabled(enabled: boolean): void {
    this.model.setAutoRecenterEnabled(enabled);
  }

  /**
   * Asks for motion permission and, if it is granted, (re)starts the sensor.
   *
   * Only needed on the web, where the browser gates device motion and requires
   * the request to come from a user gesture — call it from an `onPress`. On
   * iOS and Android the sensor starts without it, and calling it there prompts
   * for a Motion & Fitness permission the effect does not use.
   */
  async requestPermissions(): Promise<boolean> {
    const deviceMotion = getExpoSensors()?.DeviceMotion;
    if (!deviceMotion?.requestPermissionsAsync) return this.store.get().hasSensor;
    try {
      const result = await deviceMotion.requestPermissionsAsync();
      if (!result?.granted) return false;
    } catch {
      return false;
    }
    this.stop();
    await this.start();
    return this.store.get().hasSensor;
  }

  /** Sampling interval for the motion sensor, in milliseconds. */
  setUpdateInterval(intervalMs: number): void {
    this.updateIntervalMs = intervalMs;
    const deviceMotion = getExpoSensors()?.DeviceMotion;
    if (this.subscription && deviceMotion) deviceMotion.setUpdateInterval(intervalMs);
  }

  /** Starts the sensor subscription. Safe to call more than once. */
  async start(): Promise<void> {
    if (this.started || this.disposed) return;
    this.started = true;

    const deviceMotion = getExpoSensors()?.DeviceMotion;
    if (!deviceMotion) {
      warnOnce(
        'expo-sensors',
        'expo-sensors is not installed, so the fold cannot follow the device. ' +
          'Run `npx expo install expo-sensors`, or drive the tilt yourself with ' +
          'useDuoFold().setManualTilt(). '
      );
      this.store.patch({ hasSensor: false, source: 'manual' });
      return;
    }

    try {
      // Web and some Android builds gate motion behind a permission; native iOS
      // and Android grant it implicitly, so a rejection here is not fatal.
      await deviceMotion.requestPermissionsAsync?.();
      const available = await deviceMotion.isAvailableAsync();
      // `stop()` (or an unmount) may have landed while those awaits were in
      // flight; subscribing now would leak a listener nobody removes.
      if (this.disposed || !this.started) return;
      if (!available) {
        this.store.patch({ hasSensor: false, source: 'manual' });
        return;
      }
      deviceMotion.setUpdateInterval(this.updateIntervalMs);
      this.subscription = deviceMotion.addListener((measurement) => this.onSample(measurement));
      this.store.patch({
        hasSensor: true,
        source: this.manualTilt === null ? 'sensor' : 'manual',
      });
    } catch {
      this.store.patch({ hasSensor: false, source: 'manual' });
    }
  }

  /** Tears down the sensor subscription but keeps the current tilt. */
  stop(): void {
    this.started = false;
    this.subscription?.remove();
    this.subscription = null;
  }

  /** Stops for good; the engine must not be reused afterwards. */
  dispose(): void {
    this.disposed = true;
    this.stop();
  }

  private onSample(measurement: DeviceMotionMeasurement): void {
    const rotation = measurement.rotation;
    const tilt = this.model.update({
      // Web reports no fused attitude at all; the model integrates the rate
      // instead when the Euler triple is missing.
      alpha: rotation?.alpha,
      beta: rotation?.beta,
      gamma: rotation?.gamma,
      orientation: measurement.orientation ?? 0,
      rotationRate: toDeviceRate(measurement.rotationRate),
      timestamp: Date.now() / 1000,
    });

    if (tilt === null || this.manualTilt !== null) return;
    this.publish(tilt);
  }

  private publish(tiltDegrees: number): void {
    this.tilt.setValue(tiltDegrees);
    this.store.patch({ tiltDegrees, hingeSide: tiltDegrees >= 0 ? 1 : -1 });
  }
}

/**
 * Maps `expo-sensors`' `rotationRate` onto the raw device axes, in rad/s.
 *
 * The three platforms disagree about which Euler letter carries which axis:
 * iOS reports `{alpha: z, beta: y, gamma: x}`, Android reports
 * `{alpha: x, beta: y, gamma: z}`, and the web passes the browser's W3C
 * `{alpha: z, beta: x, gamma: y}` straight through. All three are in degrees
 * per second.
 */
function toDeviceRate(
  rate: { alpha: number; beta: number; gamma: number } | null | undefined
): { x: number; y: number; z: number } | undefined {
  if (!rate) return undefined;
  const alpha = rate.alpha * DEG_TO_RAD;
  const beta = rate.beta * DEG_TO_RAD;
  const gamma = rate.gamma * DEG_TO_RAD;
  switch (Platform.OS) {
    case 'ios':
      return { x: gamma, y: beta, z: alpha };
    case 'android':
      return { x: alpha, y: beta, z: gamma };
    default:
      return { x: beta, y: gamma, z: alpha };
  }
}
