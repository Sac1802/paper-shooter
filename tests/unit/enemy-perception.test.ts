import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { EnemyPerception } from '../../src/gameplay/enemies/perception.js';
it('updates target geometry each frame while bounding line-of-sight queries by their own cadence', () => {
  vi.mocked(Math.random).mockReturnValue(0);
  const position = new Vector3(),
    readEye = vi.fn((out: Vector3) => out.set(0, 1, 0));
  const world = { hasLineOfSight: vi.fn(() => true) },
    perception = new EnemyPerception(position, readEye, world);
  const target = { body: { pos: new Vector3(0, 0, -10) }, center: new Vector3(0, 1, -10) };
  expect(perception.visible).toBe(false);
  const first = perception.update(0.05, target);
  expect(first).toMatchObject({ distance: 10, height: 0, yaw: Math.PI, visible: true });
  expect(readEye).toHaveBeenCalledOnce();
  target.body.pos.x = 10;
  world.hasLineOfSight.mockReturnValue(false);
  const second = perception.update(0.05, target);
  expect(second).toBe(first);
  expect(second.distance).toBeCloseTo(Math.sqrt(200));
  expect(second.visible).toBe(true);
  expect(world.hasLineOfSight).toHaveBeenCalledOnce();
  perception.update(0.1, target);
  expect(perception.visible).toBe(false);
  expect(world.hasLineOfSight).toHaveBeenCalledTimes(2);
  expect(target.body.pos.toArray()).toEqual([10, 0, -10]);
});
it('produces finite perception at coincident positions and reads the live eye only when querying visibility', () => {
  const position = new Vector3(4, 3, 2);
  let eyeHeight = 1;
  const perception = new EnemyPerception(
    position,
    (out) => out.copy(position).add(new Vector3(0, eyeHeight, 0)),
    { hasLineOfSight: vi.fn((_from: Vector3, to: Vector3) => to.y >= 3) },
  );
  const target = { body: { pos: position.clone() }, center: position.clone() };
  const frame = perception.update(0.01, target);
  expect([frame.dx, frame.dz, frame.distance, frame.height, frame.yaw].every(Number.isFinite)).toBe(
    true,
  );
  expect(frame.distance).toBe(0);
  eyeHeight = 2;
  target.center.y = 2;
  perception.update(1, target);
  expect(perception.visible).toBe(false);
});
