import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { RemoteInterpolation } from '../../src/gameplay/remote/interpolation.js';
function fixture() {
  const body = { pos: new Vector3(), vel: new Vector3() };
  const velocity = new Vector3(4, 0, -2);
  return { body, velocity, interpolation: new RemoteInterpolation(body, velocity) };
}
it('keeps an empty replica unchanged and snaps large corrections with bounded late extrapolation', () => {
  const f = fixture();
  expect(f.interpolation.update(0.02, 1)).toBeNull();
  expect(f.body.vel).toEqual(new Vector3());
  f.interpolation.push([10, 0, -5, 0.5, 0.3], 1);
  expect(f.interpolation.previous?.t).toBeCloseTo(0.93);
  expect(f.interpolation.update(0.02, 2)).toEqual({ yaw: 0.5, pitch: 0.3 });
  expect(f.body.pos.x).toBeCloseTo(11.4);
  expect(f.body.pos.z).toBeCloseTo(-5.7);
  expect(f.body.vel).toEqual(f.velocity);
});
it('interpolates between two immutable packet copies and eases nearby corrections', () => {
  const f = fixture();
  f.velocity.set(0, 0, 0);
  const packet = [0, 0, 0, 0, 0];
  f.interpolation.push(packet, 1);
  packet[0] = 99;
  f.interpolation.push([2, 0, 0, 1, 0.4], 1.1);
  const angles = f.interpolation.update(0.01, 1.13);
  expect(angles?.yaw).toBeCloseTo(0.5);
  expect(angles?.pitch).toBeCloseTo(0.2);
  expect(f.body.pos.x).toBeCloseTo(1 - Math.exp(-0.22));
  expect(f.interpolation.previous?.p.x).toBe(0);
});
it('clears the old frame on respawn while retaining the latest pose', () => {
  const f = fixture();
  f.velocity.set(0, 0, 0);
  f.interpolation.push([0, 0, 0, 0, 0], 1);
  const latest = f.interpolation.push([2, 0, 0, 1, 0.4], 1.1);
  f.interpolation.clearPrevious();
  f.body.pos.copy(latest.p);
  expect(f.interpolation.previous).toBeNull();
  expect(f.interpolation.next).toBe(latest);
  expect(f.interpolation.update(0.01, 1.13)).toEqual({ yaw: 1, pitch: 0.4 });
  expect(f.body.pos).toEqual(new Vector3(2, 0, 0));
});
