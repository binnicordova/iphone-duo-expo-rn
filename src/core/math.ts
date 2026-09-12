/**
 * Small, dependency-free math helpers shared by the fold geometry and the
 * motion model. Everything here is pure so it can run inside a worklet, a
 * sensor callback or a unit test without touching React Native.
 */

/** Degrees -> radians. */
export const DEG_TO_RAD = Math.PI / 180;
/** Radians -> degrees. */
export const RAD_TO_DEG = 180 / Math.PI;
/** Two pi, precomputed for angle wrapping. */
export const TWO_PI = Math.PI * 2;

/** Clamps `value` into the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Wraps an angle in radians into `[-PI, PI]` (mirrors `wrapAngle` in Kotlin). */
export function wrapAngle(radians: number): number {
  let x = radians % TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
  if (x < -Math.PI) x += TWO_PI;
  return x;
}

/** Returns `value` when finite, otherwise `fallback`. */
export function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * A 3x3 matrix stored row-major in a flat array of 9 numbers, matching the
 * layout Android's `SensorManager` uses so the port stays readable next to the
 * Kotlin original.
 */
export type Mat3 = number[];

/** The 3x3 identity. */
export function mat3Identity(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

/** Transposes a row-major 3x3 matrix. */
export function mat3Transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** Multiplies two row-major 3x3 matrices (`a * b`). */
export function mat3Multiply(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
}

/**
 * Builds a device -> world rotation matrix from the W3C device-orientation
 * Euler angles reported by `expo-sensors`' `DeviceMotion.rotation`
 * (`alpha` about Z, `beta` about X, `gamma` about Y, all in radians, applied
 * in Z-X-Y order). This is the portable analog of Android's
 * `SensorManager.getRotationMatrixFromVector`.
 */
export function mat3FromEulerZXY(alpha: number, beta: number, gamma: number): Mat3 {
  const cA = Math.cos(alpha);
  const sA = Math.sin(alpha);
  const cB = Math.cos(beta);
  const sB = Math.sin(beta);
  const cG = Math.cos(gamma);
  const sG = Math.sin(gamma);

  // Rz(alpha) * Rx(beta) * Ry(gamma), expanded.
  return [
    cA * cG - sA * sB * sG,
    -sA * cB,
    cA * sG + sA * sB * cG,

    sA * cG + cA * sB * sG,
    cA * cB,
    sA * sG - cA * sB * cG,

    -cB * sG,
    sB,
    cB * cG,
  ];
}

/**
 * Columns of this matrix are the screen axes (screen-right, screen-up,
 * screen-normal) expressed in raw device coordinates, for a display rotated by
 * `orientationDegrees`. Multiplying a device -> world matrix by it on the right
 * yields a screen -> world matrix — the portable equivalent of Android's
 * `SensorManager.remapCoordinateSystem`.
 */
export function screenAxesInDeviceSpace(orientationDegrees: number): Mat3 {
  // Normalize -90 / 270 and friends into 0 | 90 | 180 | 270.
  const rotation = (((Math.round(orientationDegrees / 90) * 90) % 360) + 360) % 360;
  switch (rotation) {
    case 90:
      // screen-right = device +Y, screen-up = device -X
      return [0, -1, 0, 1, 0, 0, 0, 0, 1];
    case 180:
      return [-1, 0, 0, 0, -1, 0, 0, 0, 1];
    case 270:
      // screen-right = device -Y, screen-up = device +X
      return [0, 1, 0, -1, 0, 0, 0, 0, 1];
    default:
      return mat3Identity();
  }
}

/** Screen-up (Y) axis expressed in raw device coordinates, for the gyro dot. */
export function screenUpInDeviceSpace(orientationDegrees: number): [number, number, number] {
  const p = screenAxesInDeviceSpace(orientationDegrees);
  return [p[1], p[4], p[7]];
}
