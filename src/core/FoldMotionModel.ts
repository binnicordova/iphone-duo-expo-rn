import {
  clamp,
  mat3FromEulerZXY,
  mat3Identity,
  mat3Multiply,
  mat3Transpose,
  Mat3,
  RAD_TO_DEG,
  screenAxesInDeviceSpace,
  screenUpInDeviceSpace,
  wrapAngle,
} from './math';

/** Tuning constants, ported 1:1 from the Kotlin `FoldMotionModel`. */
export const MOTION_DEFAULTS = {
  /** Fraction of the remaining error closed per sample. */
  smoothing: 0.7,
  /** Gyro extrapolation horizon, in seconds. */
  predictionIntervalSeconds: 0.04,
  /** Auto-recenter washout time constant, in seconds. */
  recenterTauSeconds: 15,
  /** Below this angular rate (rad/s) the device counts as still. */
  stillThresholdRadPerSecond: 0.15,
  /** Hard limit on the reported tilt magnitude. */
  maxTiltDegrees: 45,
};

/** Options accepted by {@link FoldMotionModel}. */
export interface FoldMotionOptions {
  smoothing?: number;
  predictionIntervalSeconds?: number;
  recenterTauSeconds?: number;
  stillThresholdRadPerSecond?: number;
  maxTiltDegrees?: number;
  /** Starts with the auto-recenter washout on (default `true`). */
  autoRecenter?: boolean;
}

/** One orientation sample, in the shape `expo-sensors` reports it. */
export interface OrientationSample {
  /**
   * Rotation about the device Z axis, in radians. Omit the whole Euler triple
   * on platforms that report no fused attitude — `expo-sensors` does not
   * provide one on web — and the model integrates `rotationRate` instead.
   */
  alpha?: number;
  /** Rotation about the device X axis, in radians. */
  beta?: number;
  /** Rotation about the device Y axis, in radians. */
  gamma?: number;
  /** Screen rotation in degrees (`0`, `90`, `180`, `-90`). Defaults to `0`. */
  orientation?: number;
  /** Angular rate in the raw device frame, rad/s. Optional but improves latency. */
  rotationRate?: { x: number; y: number; z: number };
  /** Sample time in seconds. Defaults to `Date.now() / 1000`. */
  timestamp?: number;
}

/**
 * Derives the device's tilt around the screen-space Y axis relative to a
 * calibrated "zero tilt" pose — a direct port of the Kotlin `FoldMotionModel`,
 * with the platform sensor plumbing lifted out so the model itself stays pure
 * and testable.
 *
 * Per sample: remap the device rotation into screen axes (columns =
 * screen-right, screen-up, screen-normal, honouring the display rotation),
 * then `relative = referenceᵀ · current` and
 * `measured = atan2(normal.x, normal.z)` — the screen normal's excursion
 * toward screen-right. Positive means the right edge is farther from the
 * viewer, which puts the hinge on the right and the frost on the left.
 *
 * Rotation-rate prediction covers sensor and display latency, a light low-pass
 * keeps hand and screen glued, and a slow washout baseline absorbs drift while
 * the device is nearly still so the zero pose maintains itself.
 */
export class FoldMotionModel {
  private readonly options: Required<Omit<FoldMotionOptions, 'autoRecenter'>>;

  private reference: Mat3 | null = null;
  private pendingRecalibrate = false;

  private tiltRad = 0;
  private integratedRad = 0;
  private baselineRad = 0;
  private lastPredicted = 0;
  private autoRecenter: boolean;
  private lastTimestamp = 0;

  /** Smoothed tilt in degrees, clamped to the configured range. */
  tiltDegrees = 0;
  /** `+1` = hinge on the right edge, `-1` = hinge on the left edge. */
  hingeSide: 1 | -1 = 1;

  constructor(options: FoldMotionOptions = {}) {
    this.options = {
      smoothing: options.smoothing ?? MOTION_DEFAULTS.smoothing,
      predictionIntervalSeconds:
        options.predictionIntervalSeconds ?? MOTION_DEFAULTS.predictionIntervalSeconds,
      recenterTauSeconds: options.recenterTauSeconds ?? MOTION_DEFAULTS.recenterTauSeconds,
      stillThresholdRadPerSecond:
        options.stillThresholdRadPerSecond ?? MOTION_DEFAULTS.stillThresholdRadPerSecond,
      maxTiltDegrees: options.maxTiltDegrees ?? MOTION_DEFAULTS.maxTiltDegrees,
    };
    this.autoRecenter = options.autoRecenter ?? true;
  }

  /** Makes the current pose the zero-tilt pose. */
  recalibrate(): void {
    this.pendingRecalibrate = true;
    // Snap back immediately while waiting for the next sample.
    this.tiltRad = 0;
    this.baselineRad = 0;
    this.tiltDegrees = 0;
    this.hingeSide = 1;
  }

  /** Drops the calibration entirely; the next sample becomes the new zero. */
  reset(): void {
    this.reference = null;
    this.integratedRad = 0;
    this.recalibrate();
    this.lastTimestamp = 0;
    this.lastPredicted = 0;
  }

  /**
   * Enables or disables the auto-recenter washout. Enabling snaps the baseline
   * to the latest reading so the output does not jump.
   */
  setAutoRecenterEnabled(enabled: boolean): void {
    this.autoRecenter = enabled;
    if (enabled) this.baselineRad = this.lastPredicted;
  }

  /** Whether the auto-recenter washout is currently on. */
  isAutoRecenterEnabled(): boolean {
    return this.autoRecenter;
  }

  /**
   * Feeds one orientation sample and returns the updated tilt in degrees.
   * Returns `null` for the calibration sample, where there is nothing to report
   * yet.
   */
  update(sample: OrientationSample): number | null {
    const now = sample.timestamp ?? Date.now() / 1000;
    const dt = this.lastTimestamp === 0 ? 0.02 : clamp(now - this.lastTimestamp, 0, 0.5);
    const orientation = sample.orientation ?? 0;

    // Angular rate around the screen's Y axis — the axis this effect tracks.
    const rate = sample.rotationRate;
    let omegaY = 0;
    if (rate) {
      const up = screenUpInDeviceSpace(orientation);
      omegaY = rate.x * up[0] + rate.y * up[1] + rate.z * up[2];
    }

    const measured = this.measure(sample, orientation, omegaY, dt);
    if (measured === null) {
      this.lastTimestamp = now;
      return null;
    }
    this.lastTimestamp = now;

    // Extrapolate along the rotation rate to cover sensor and display latency.
    const predicted = rate ? measured + omegaY * this.options.predictionIntervalSeconds : measured;
    this.lastPredicted = predicted;

    // Auto-recenter washout: while the device is nearly still, drag the slow
    // baseline toward the reading so drift cannot accumulate into a permanent
    // offset. Deliberate motion is left untouched.
    if (this.autoRecenter) {
      const omegaMagnitude = rate
        ? Math.sqrt(rate.x * rate.x + rate.y * rate.y + rate.z * rate.z)
        : 0;
      if (omegaMagnitude < this.options.stillThresholdRadPerSecond) {
        const alpha = clamp(dt / this.options.recenterTauSeconds, 0, 1);
        this.baselineRad += wrapAngle(predicted - this.baselineRad) * alpha;
      }
    }

    const target = this.autoRecenter ? wrapAngle(predicted - this.baselineRad) : predicted;
    this.tiltRad += wrapAngle(target - this.tiltRad) * this.options.smoothing;

    const maxTilt = this.options.maxTiltDegrees;
    this.tiltDegrees = clamp(this.tiltRad * RAD_TO_DEG, -maxTilt, maxTilt);
    this.hingeSide = this.tiltDegrees >= 0 ? 1 : -1;
    return this.tiltDegrees;
  }

  /**
   * The raw tilt reading for one sample, or `null` when the sample only served
   * to latch the zero pose.
   *
   * With a fused attitude this is the excursion of the screen normal toward
   * screen-right, measured in the calibrated screen frame. Without one — web
   * reports no attitude — it is the integral of the rate around the screen's Y
   * axis, which drifts on its own but is exactly what the washout above is
   * there to absorb.
   */
  private measure(
    sample: OrientationSample,
    orientation: number,
    omegaY: number,
    dt: number
  ): number | null {
    if (sample.alpha === undefined || sample.beta === undefined || sample.gamma === undefined) {
      if (!sample.rotationRate) return null;
      if (this.pendingRecalibrate || this.reference === null) {
        // Nothing to latch, but the same handshake keeps both paths identical
        // from the caller's point of view.
        this.reference = mat3Identity();
        this.pendingRecalibrate = false;
        this.integratedRad = 0;
        this.tiltRad = 0;
        this.tiltDegrees = 0;
        this.hingeSide = 1;
        return null;
      }
      this.integratedRad = wrapAngle(this.integratedRad + omegaY * dt);
      return this.integratedRad;
    }

    const screen = mat3Multiply(
      mat3FromEulerZXY(sample.alpha, sample.beta, sample.gamma),
      screenAxesInDeviceSpace(orientation)
    );

    if (this.reference === null || this.pendingRecalibrate) {
      this.reference = screen.slice();
      this.pendingRecalibrate = false;
      this.integratedRad = 0;
      this.tiltRad = 0;
      this.tiltDegrees = 0;
      this.hingeSide = 1;
      return null;
    }

    // Current screen axes expressed in the calibrated screen frame; column 2 is
    // the screen normal, and its excursion toward screen-right is the tilt.
    const relative = mat3Multiply(mat3Transpose(this.reference), screen);
    return Math.atan2(relative[2], relative[8]);
  }
}
