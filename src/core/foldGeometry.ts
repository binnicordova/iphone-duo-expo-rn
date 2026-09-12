import { clamp, DEG_TO_RAD } from './math';

/**
 * Physical parameters of the frosted-glass fold, mirroring `FoldParameters` in
 * the Kotlin/Swift originals. Everything is expressed in density-independent
 * points (dp) because that is the unit React Native lays out and transforms in;
 * `dpPerMillimeter` is the bridge back to the physical millimetres the original
 * model is authored in.
 */
export interface FoldParameters {
  /**
   * Distance from the viewer's eyes to the untilted screen, looking at it
   * head-on. The eye stays there while the device tilts. A larger distance
   * flattens the perspective magnification — less sideways stretch and less
   * edge cropping at big tilts — while the gap-driven blur/darken is
   * completely unaffected.
   */
  eyeDistanceMillimeters: number;
  /**
   * Density of layout points. One dp is nominally 1/160 inch, so the default
   * 160/25.4 also happens to match the ~6 units/mm the original iOS effect is
   * authored at. Override it to pin the look to a specific physical density.
   */
  dpPerMillimeter: number;
  /**
   * Blur radius gained per dp of separation between the glass and the UI plane
   * (the tangent of the scattering half-angle).
   */
  blurSpread: number;
  /**
   * Fraction of light lost per dp of blur radius — the frostier the glass, the
   * darker it gets. Authored at the 6 units/mm reference density of the
   * original and normalized by `dpPerMillimeter`, so the look is
   * density-independent.
   */
  darkening: number;
  /** Blur radius (dp) that saturates the blur layer at full strength. */
  maxBlurRadiusDp: number;
  /** Hard limit on the tilt magnitude, mirroring the shader's stable range. */
  maxTiltDegrees: number;
}

/** Defaults ported 1:1 from the Kotlin reference. */
export const DEFAULT_FOLD_PARAMETERS: FoldParameters = {
  eyeDistanceMillimeters: 450,
  dpPerMillimeter: 160 / 25.4,
  blurSpread: 0.12,
  darkening: 0.015,
  maxBlurRadiusDp: 32,
  maxTiltDegrees: 45,
};

/** Absolute ceiling for `maxTiltDegrees`; beyond this the projection degenerates. */
export const TILT_LIMIT_DEGREES = 60;

/**
 * The view transform that reproduces the reference shader's warp, split into
 * the two nested layers the renderer applies:
 *
 * - the outer layer gets a plain 2D `translateX` (screen space, applied after
 *   the projection), and
 * - the inner layer gets `[{perspective}, {rotateY}, {scaleX}, {scaleY}]`.
 *
 * Splitting it this way keeps every value inside the narrow subset of 3D
 * transforms that iOS, Android and web all reproduce identically — Android
 * decomposes transform matrices into `rotationY` + `cameraDistance` + scale +
 * 2D translation, so a hand-rolled homography would not survive the trip.
 */
export interface FoldTransform {
  /** Camera distance for the inner layer, in dp. */
  perspective: number;
  /** Rotation of the inner layer about its vertical centre line, in degrees. */
  rotateYDegrees: number;
  /** Horizontal scale of the inner layer. */
  scaleX: number;
  /** Vertical scale of the inner layer. */
  scaleY: number;
  /** Screen-space horizontal offset applied by the outer layer, in dp. */
  translateX: number;
}

/** The identity transform, used at zero tilt and for degenerate layouts. */
export const IDENTITY_FOLD_TRANSFORM: FoldTransform = {
  perspective: 1000,
  rotateYDegrees: 0,
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
};

/** Converts the eye distance to dp and keeps it safely behind the glass. */
export function eyeDistanceDp(parameters: FoldParameters, widthDp: number): number {
  const raw = parameters.eyeDistanceMillimeters * parameters.dpPerMillimeter;
  // A viewer closer than the screen is wide makes the projection blow up long
  // before the 45 degree limit, so hold the eye at a sane minimum.
  return Math.max(raw, widthDp * 1.5, 1);
}

/** `+1` = hinge on the right edge, `-1` = hinge on the left edge. */
export function hingeSideForTilt(tiltDegrees: number): 1 | -1 {
  return tiltDegrees >= 0 ? 1 : -1;
}

/**
 * Solves the view transform for a signed tilt.
 *
 * The reference shader maps, per pixel, from the *output* position (treated as
 * arc length along the tilted glass) back to the UI plane behind it:
 *
 * ```
 * d     = |x - hingeX|                  // distance from the hinge, along the glass
 * glass = hingeX +- d * cos(tilt)       // the glass point, rotated about the hinge
 * gap   = d * sin(tilt)                 // how far the glass lifted toward the eye
 * hit   = centre + (glass - centre) * E / (E - gap)
 * ```
 *
 * That map is a homography, so its inverse — the warp a renderer has to apply
 * to the content — is a homography too, and this function expresses it exactly
 * in the restricted "scale, rotate about the centre under a camera, then
 * translate on screen" family every platform supports. Accuracy against the
 * shader model is machine precision; see `__tests__/foldGeometry-test.ts`.
 */
export function solveFoldTransform(
  tiltDegrees: number,
  widthDp: number,
  parameters: FoldParameters = DEFAULT_FOLD_PARAMETERS
): FoldTransform {
  const maxTilt = clamp(parameters.maxTiltDegrees, 0, TILT_LIMIT_DEGREES);
  const tilt = clamp(tiltDegrees, -maxTilt, maxTilt);

  if (!(widthDp > 1) || Math.abs(tilt) < 1e-4) {
    return { ...IDENTITY_FOLD_TRANSFORM, perspective: eyeDistanceDp(parameters, widthDp) };
  }

  const E = eyeDistanceDp(parameters, widthDp);
  const half = widthDp / 2;
  const hinge = hingeSideForTilt(tilt);
  const theta = Math.abs(tilt) * DEG_TO_RAD;
  const c = Math.cos(theta);
  const s = Math.sin(theta);

  // Hinge offset from the centre, and the two numerators of the homography.
  const h = hinge * half;
  const A = E - half * s;
  const G = E * c - half * s;

  // Screen-space offset that pins the hinge edge in place.
  const translateX = (h * (c - 1)) / c;
  // Horizontal numerator once the screen-space offset is factored out.
  const K = (A + translateX * hinge * s) / (E * c);

  return {
    perspective: K * E,
    rotateYDegrees: -tilt,
    scaleX: K / c,
    scaleY: G / (E * c),
    translateX,
  };
}

/**
 * Blur radius in dp for a point `distanceFromHingeDp` away from the hinge —
 * the shader's `blurSpread * gap`.
 */
export function foldBlurRadiusDp(
  distanceFromHingeDp: number,
  tiltDegrees: number,
  parameters: FoldParameters = DEFAULT_FOLD_PARAMETERS
): number {
  const maxTilt = clamp(parameters.maxTiltDegrees, 0, TILT_LIMIT_DEGREES);
  const theta = Math.abs(clamp(tiltDegrees, -maxTilt, maxTilt)) * DEG_TO_RAD;
  const gap = Math.max(distanceFromHingeDp, 0) * Math.sin(theta);
  return parameters.blurSpread * gap;
}

/**
 * Opacity of the black overlay that reproduces the shader's `atten` term
 * (`1 - darkening * radius`) at a given distance from the hinge.
 */
export function foldDarkenAlpha(
  distanceFromHingeDp: number,
  tiltDegrees: number,
  parameters: FoldParameters = DEFAULT_FOLD_PARAMETERS
): number {
  // `darkening` is authored per unit at the 6 units/mm reference density of the
  // original; normalize by the real density so the look matches on any screen.
  const darkening = (parameters.darkening * 6) / parameters.dpPerMillimeter;
  const radius = foldBlurRadiusDp(distanceFromHingeDp, tiltDegrees, parameters);
  return clamp(darkening * radius, 0, 1);
}

/**
 * Normalized blur strength in `[0, 1]` for a point `distanceFromHingeDp` away
 * from the hinge. Renderers scale this into whatever their blur primitive
 * expects (`expo-blur` uses 0-100).
 */
export function foldBlurStrength(
  distanceFromHingeDp: number,
  tiltDegrees: number,
  parameters: FoldParameters = DEFAULT_FOLD_PARAMETERS
): number {
  const radius = foldBlurRadiusDp(distanceFromHingeDp, tiltDegrees, parameters);
  return clamp(radius / Math.max(parameters.maxBlurRadiusDp, 1), 0, 1);
}

/**
 * Reference implementation of the shader's forward map: given an output point,
 * returns the point of the UI plane it samples. Not used by the renderer —
 * it exists so the transform solver can be verified against the model it
 * claims to reproduce.
 */
export function sampleUiPlane(
  outputX: number,
  outputY: number,
  tiltDegrees: number,
  widthDp: number,
  heightDp: number,
  parameters: FoldParameters = DEFAULT_FOLD_PARAMETERS
): [number, number] {
  const maxTilt = clamp(parameters.maxTiltDegrees, 0, TILT_LIMIT_DEGREES);
  const tilt = clamp(tiltDegrees, -maxTilt, maxTilt);
  const theta = Math.abs(tilt) * DEG_TO_RAD;
  const E = eyeDistanceDp(parameters, widthDp);
  const hinge = hingeSideForTilt(tilt);
  const hingeX = hinge > 0 ? widthDp : 0;
  const away = hinge > 0 ? -1 : 1;

  const d = Math.abs(outputX - hingeX);
  const glassX = hingeX + away * d * Math.cos(theta);
  const gap = d * Math.sin(theta);
  const k = E / (E - gap);

  return [widthDp / 2 + (glassX - widthDp / 2) * k, heightDp / 2 + (outputY - heightDp / 2) * k];
}
