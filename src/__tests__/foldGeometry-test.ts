import {
  DEFAULT_FOLD_PARAMETERS,
  eyeDistanceDp,
  foldBlurRadiusDp,
  foldDarkenAlpha,
  hingeSideForTilt,
  sampleUiPlane,
  solveFoldTransform,
  type FoldParameters,
} from '../core/foldGeometry';

/** Applies the solved transform the way the renderer's two nested layers do. */
function project(
  contentX: number,
  contentY: number,
  tiltDegrees: number,
  widthDp: number,
  parameters: FoldParameters
): [number, number] {
  const t = solveFoldTransform(tiltDegrees, widthDp, parameters);
  const phi = (t.rotateYDegrees * Math.PI) / 180;

  // Inner layer: scale, then rotate about the vertical centre line under a
  // camera `perspective` away.
  const x = t.scaleX * contentX;
  const y = t.scaleY * contentY;
  const rotatedX = x * Math.cos(phi);
  const rotatedZ = -x * Math.sin(phi);
  const w = 1 - rotatedZ / t.perspective;

  // Outer layer: a plain screen-space offset.
  return [rotatedX / w + t.translateX, y / w];
}

describe('solveFoldTransform', () => {
  const width = 393;
  const height = 852;

  it('is the identity at zero tilt', () => {
    const t = solveFoldTransform(0, width);
    expect(t.rotateYDegrees).toBe(0);
    expect(t.scaleX).toBeCloseTo(1, 10);
    expect(t.scaleY).toBeCloseTo(1, 10);
    expect(t.translateX).toBeCloseTo(0, 10);
  });

  it('inverts the reference shader projection to machine precision', () => {
    for (const parameters of [
      DEFAULT_FOLD_PARAMETERS,
      { ...DEFAULT_FOLD_PARAMETERS, eyeDistanceMillimeters: 320 },
      { ...DEFAULT_FOLD_PARAMETERS, eyeDistanceMillimeters: 900 },
    ]) {
      for (const tilt of [-45, -25, -10, -0.5, 0.5, 10, 25, 45]) {
        for (let i = 0; i <= 12; i++) {
          for (let j = 0; j <= 12; j++) {
            const outX = (i / 12) * width;
            const outY = (j / 12) * height;
            // The shader reads the UI plane at `sample` for the output pixel
            // (outX, outY); the transform must therefore put that content point
            // back on that pixel.
            const sample = sampleUiPlane(outX, outY, tilt, width, height, parameters);
            const [x, y] = project(
              sample[0] - width / 2,
              sample[1] - height / 2,
              tilt,
              width,
              parameters
            );
            expect(x).toBeCloseTo(outX - width / 2, 6);
            expect(y).toBeCloseTo(outY - height / 2, 6);
          }
        }
      }
    }
  });

  it('pins the hinge edge and lifts the free edge toward the viewer', () => {
    // Hinge on the right: the right edge of the content stays put.
    const right = project(width / 2, 0, 45, width, DEFAULT_FOLD_PARAMETERS);
    expect(right[0]).toBeCloseTo(width / 2, 6);
    // Hinge on the left: the left edge stays put.
    const left = project(-width / 2, 0, -45, width, DEFAULT_FOLD_PARAMETERS);
    expect(left[0]).toBeCloseTo(-width / 2, 6);
  });

  it('mirrors exactly when the hinge flips', () => {
    const right = solveFoldTransform(30, width);
    const left = solveFoldTransform(-30, width);
    expect(left.scaleX).toBeCloseTo(right.scaleX, 10);
    expect(left.scaleY).toBeCloseTo(right.scaleY, 10);
    expect(left.perspective).toBeCloseTo(right.perspective, 10);
    expect(left.translateX).toBeCloseTo(-right.translateX, 10);
    expect(left.rotateYDegrees).toBeCloseTo(-right.rotateYDegrees, 10);
  });

  it('stays continuous across the hinge flip at zero', () => {
    const epsilon = 1e-6;
    const positive = solveFoldTransform(epsilon, width);
    const negative = solveFoldTransform(-epsilon, width);
    expect(positive.translateX).toBeCloseTo(negative.translateX, 6);
    expect(positive.scaleX).toBeCloseTo(negative.scaleX, 6);
  });

  it('clamps the tilt to the configured range', () => {
    const clamped = solveFoldTransform(400, width);
    const atLimit = solveFoldTransform(DEFAULT_FOLD_PARAMETERS.maxTiltDegrees, width);
    expect(clamped).toEqual(atLimit);
  });

  it('keeps the eye behind the glass for narrow eye distances', () => {
    const parameters = { ...DEFAULT_FOLD_PARAMETERS, eyeDistanceMillimeters: 1 };
    expect(eyeDistanceDp(parameters, width)).toBeGreaterThanOrEqual(width * 1.5);
    const t = solveFoldTransform(45, width, parameters);
    expect(Number.isFinite(t.perspective)).toBe(true);
    expect(t.perspective).toBeGreaterThan(0);
  });

  it('is well behaved for the piecewise-linear tables the renderer bakes', () => {
    // The renderer samples every ~1.4 degrees; the error between samples has to
    // stay far below a pixel.
    const step = DEFAULT_FOLD_PARAMETERS.maxTiltDegrees / 32;
    let worst = 0;
    for (let tilt = -45; tilt < 45; tilt += step / 4) {
      const lower = Math.floor(tilt / step) * step;
      const upper = lower + step;
      const mix = (tilt - lower) / step;
      const a = solveFoldTransform(lower, width);
      const b = solveFoldTransform(upper, width);
      const exact = solveFoldTransform(tilt, width);
      const lerped = a.scaleX + (b.scaleX - a.scaleX) * mix;
      worst = Math.max(worst, Math.abs(lerped - exact.scaleX) * width);
    }
    expect(worst).toBeLessThan(0.5);
  });
});

describe('blur and darkening', () => {
  it('grows with the gap and vanishes at the hinge', () => {
    expect(foldBlurRadiusDp(0, 45)).toBe(0);
    expect(foldBlurRadiusDp(393, 45)).toBeGreaterThan(foldBlurRadiusDp(393, 20));
    expect(foldBlurRadiusDp(393, 0)).toBe(0);
  });

  it('matches the reference attenuation curve', () => {
    // atten = 1 - darkening * blurSpread * gap, normalized to 6 units/mm.
    const parameters = DEFAULT_FOLD_PARAMETERS;
    const distance = 300;
    const tilt = 45;
    const normalized = (parameters.darkening * 6) / parameters.dpPerMillimeter;
    const expected = normalized * parameters.blurSpread * distance * Math.sin((45 * Math.PI) / 180);
    expect(foldDarkenAlpha(distance, tilt)).toBeCloseTo(expected, 10);
  });

  it('never exceeds full black', () => {
    const parameters = { ...DEFAULT_FOLD_PARAMETERS, darkening: 10 };
    expect(foldDarkenAlpha(1000, 45, parameters)).toBe(1);
  });
});

describe('hingeSideForTilt', () => {
  it('follows the tilt sign and never hardcodes a side', () => {
    expect(hingeSideForTilt(12)).toBe(1);
    expect(hingeSideForTilt(0)).toBe(1);
    expect(hingeSideForTilt(-0.001)).toBe(-1);
  });
});
