import { FoldMotionModel, type OrientationSample } from '../core/FoldMotionModel';
import { mat3FromEulerZXY, screenAxesInDeviceSpace, screenUpInDeviceSpace } from '../core/math';

/** A sample that is `yawDegrees` away from the identity pose. */
function sample(yawDegrees: number, overrides: Partial<OrientationSample> = {}): OrientationSample {
  return {
    alpha: 0,
    beta: 0,
    // gamma rotates about the device Y axis, which is what the fold tracks.
    gamma: (yawDegrees * Math.PI) / 180,
    orientation: 0,
    timestamp: 0,
    ...overrides,
  };
}

describe('FoldMotionModel', () => {
  it('treats the first sample as the zero pose', () => {
    const model = new FoldMotionModel();
    expect(model.update(sample(17))).toBeNull();
    expect(model.tiltDegrees).toBe(0);
  });

  it('converges on the relative tilt', () => {
    const model = new FoldMotionModel({ autoRecenter: false });
    model.update(sample(0));
    let tilt = 0;
    for (let i = 0; i < 40; i++) tilt = model.update(sample(20, { timestamp: i * 0.02 })) ?? tilt;
    expect(tilt).toBeCloseTo(20, 1);
  });

  it('flips the hinge with the tilt sign', () => {
    const model = new FoldMotionModel({ autoRecenter: false });
    model.update(sample(0));
    for (let i = 0; i < 40; i++) model.update(sample(-15, { timestamp: i * 0.02 }));
    expect(model.tiltDegrees).toBeLessThan(0);
    expect(model.hingeSide).toBe(-1);

    for (let i = 0; i < 60; i++) model.update(sample(15, { timestamp: 1 + i * 0.02 }));
    expect(model.tiltDegrees).toBeGreaterThan(0);
    expect(model.hingeSide).toBe(1);
  });

  it('clamps to the configured range', () => {
    const model = new FoldMotionModel({ autoRecenter: false, maxTiltDegrees: 30 });
    model.update(sample(0));
    for (let i = 0; i < 60; i++) model.update(sample(80, { timestamp: i * 0.02 }));
    expect(model.tiltDegrees).toBe(30);
  });

  it('re-zeroes on recalibrate', () => {
    const model = new FoldMotionModel({ autoRecenter: false });
    model.update(sample(0));
    for (let i = 0; i < 40; i++) model.update(sample(25, { timestamp: i * 0.02 }));
    expect(model.tiltDegrees).toBeGreaterThan(20);

    model.recalibrate();
    expect(model.tiltDegrees).toBe(0);
    expect(model.update(sample(25, { timestamp: 1 }))).toBeNull();
    expect(model.update(sample(25, { timestamp: 1.02 }))).toBeCloseTo(0, 6);
  });

  it('washes a static offset back to zero when auto-recenter is on', () => {
    const model = new FoldMotionModel({ autoRecenter: true, recenterTauSeconds: 0.5 });
    model.update(sample(0));
    // Held still (no rotation rate reported) at a steady 10 degrees.
    let tilt = 0;
    for (let i = 0; i < 400; i++) tilt = model.update(sample(10, { timestamp: i * 0.02 })) ?? tilt;
    expect(Math.abs(tilt)).toBeLessThan(1);
  });

  it('leaves deliberate motion alone while the device is moving', () => {
    const model = new FoldMotionModel({ autoRecenter: true, recenterTauSeconds: 0.5 });
    model.update(sample(0));
    let tilt = 0;
    for (let i = 0; i < 200; i++) {
      tilt =
        model.update(
          // A rate well above the stillness threshold keeps the washout parked.
          sample(10, { timestamp: i * 0.02, rotationRate: { x: 0, y: 0, z: 1.2 } })
        ) ?? tilt;
    }
    expect(tilt).toBeCloseTo(10, 0);
  });

  it('uses the rotation rate to lead the measurement', () => {
    const predictive = new FoldMotionModel({ autoRecenter: false });
    const plain = new FoldMotionModel({ autoRecenter: false });
    predictive.update(sample(0));
    plain.update(sample(0));

    const rate = { x: 0, y: 1, z: 0 }; // 1 rad/s about the device Y axis
    predictive.update(sample(5, { timestamp: 0.02, rotationRate: rate }));
    plain.update(sample(5, { timestamp: 0.02 }));
    expect(predictive.tiltDegrees).toBeGreaterThan(plain.tiltDegrees);
  });

  it('tracks the tilt the same way in landscape', () => {
    const portrait = new FoldMotionModel({ autoRecenter: false });
    const landscape = new FoldMotionModel({ autoRecenter: false });
    portrait.update(sample(0, { orientation: 0 }));
    landscape.update(sample(0, { orientation: 90 }));

    for (let i = 0; i < 40; i++) {
      portrait.update(sample(12, { orientation: 0, timestamp: i * 0.02 }));
      // In landscape the screen's Y axis is the device's -X axis, so the same
      // on-screen tilt comes from a rotation about beta instead.
      landscape.update({
        alpha: 0,
        beta: (-12 * Math.PI) / 180,
        gamma: 0,
        orientation: 90,
        timestamp: i * 0.02,
      });
    }
    expect(landscape.tiltDegrees).toBeCloseTo(portrait.tiltDegrees, 1);
  });
});

describe('FoldMotionModel without a fused attitude', () => {
  /** What a web sample looks like: a rate, no Euler triple. */
  function rateSample(omegaY: number, timestamp: number): OrientationSample {
    return { orientation: 0, timestamp, rotationRate: { x: 0, y: omegaY, z: 0 } };
  }

  it('integrates the rotation rate around the screen Y axis', () => {
    const model = new FoldMotionModel({
      autoRecenter: false,
      smoothing: 1,
      predictionIntervalSeconds: 0,
    });
    expect(model.update(rateSample(0, 0))).toBeNull();

    // 0.5 rad/s for one second is ~28.6 degrees.
    let tilt = 0;
    for (let i = 1; i <= 50; i++) tilt = model.update(rateSample(0.5, i * 0.02)) ?? tilt;
    expect(tilt).toBeCloseTo(28.6, 0);
  });

  it('still leads the integral by the prediction horizon', () => {
    const model = new FoldMotionModel({ autoRecenter: false, smoothing: 1 });
    model.update(rateSample(0, 0));
    let tilt = 0;
    for (let i = 1; i <= 50; i++) tilt = model.update(rateSample(0.5, i * 0.02)) ?? tilt;
    // 40 ms of lead at 0.5 rad/s is another ~1.15 degrees.
    expect(tilt).toBeCloseTo(29.8, 0);
  });

  it('reports nothing when neither attitude nor rate is available', () => {
    const model = new FoldMotionModel();
    expect(model.update({ orientation: 0, timestamp: 0 })).toBeNull();
    expect(model.update({ orientation: 0, timestamp: 0.02 })).toBeNull();
  });

  it('lets the washout absorb the drift the integration accumulates', () => {
    const model = new FoldMotionModel({ autoRecenter: true, recenterTauSeconds: 0.5 });
    model.update(rateSample(0, 0));
    // A small constant bias is exactly what an uncorrected gyro looks like.
    let tilt = 0;
    for (let i = 1; i <= 600; i++) tilt = model.update(rateSample(0.02, i * 0.02)) ?? tilt;
    expect(Math.abs(tilt)).toBeLessThan(3);
  });
});

describe('screen axis remapping', () => {
  it('is orthonormal for every display rotation', () => {
    for (const rotation of [0, 90, 180, 270, -90]) {
      const p = screenAxesInDeviceSpace(rotation);
      const columns = [
        [p[0], p[3], p[6]],
        [p[1], p[4], p[7]],
        [p[2], p[5], p[8]],
      ];
      for (const column of columns) {
        expect(Math.hypot(...column)).toBeCloseTo(1, 10);
      }
      // Right-handed: x cross y = z.
      const [x, y, z] = columns;
      const cross = [
        x[1] * y[2] - x[2] * y[1],
        x[2] * y[0] - x[0] * y[2],
        x[0] * y[1] - x[1] * y[0],
      ];
      cross.forEach((component, index) => expect(component).toBeCloseTo(z[index], 10));
    }
  });

  it('matches the Android remap conventions', () => {
    expect(screenUpInDeviceSpace(0)).toEqual([0, 1, 0]);
    expect(screenUpInDeviceSpace(90)).toEqual([-1, 0, 0]);
    expect(screenUpInDeviceSpace(180)).toEqual([0, -1, 0]);
    expect(screenUpInDeviceSpace(270)).toEqual([1, 0, 0]);
    expect(screenUpInDeviceSpace(-90)).toEqual([1, 0, 0]);
  });

  it('builds an orthonormal rotation from Euler angles', () => {
    const m = mat3FromEulerZXY(0.3, -0.7, 1.1);
    for (let row = 0; row < 3; row++) {
      expect(Math.hypot(m[row * 3], m[row * 3 + 1], m[row * 3 + 2])).toBeCloseTo(1, 10);
    }
  });
});
