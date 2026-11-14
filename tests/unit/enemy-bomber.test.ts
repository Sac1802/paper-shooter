import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { TYPES } from '../../src/domain/enemies.js';
import { makeBody } from '../../src/engine/physics.js';
import { BomberBehavior } from '../../src/gameplay/enemies/bomber-behavior.js';
import type { PerceivedTarget } from '../../src/gameplay/enemies/perception.js';
function fixture() {
  const body = makeBody(new Vector3(), 0.3, 1.8),
    motion = { heading: 0, steer: vi.fn(() => 0), follow: vi.fn(() => 0) };
  const actions = { flash: vi.fn(), fuse: vi.fn(), explode: vi.fn() },
    behavior = new BomberBehavior(TYPES.bomber, body, motion, actions);
  const target: PerceivedTarget = {
    position: new Vector3(0, 0, 3),
    center: new Vector3(0, 1, 3),
    dx: 0,
    dz: 3,
    distance: 3,
    height: 0,
    yaw: 0.8,
    visible: true,
  };
  return { body, motion, actions, behavior, target };
}
it('arms once in visible range, stops pursuit during the fuse and emits its explosion at expiry', () => {
  const { body, motion, actions, behavior, target } = fixture();
  body.vel.set(5, 0, 5);
  behavior.update(0.05, target);
  expect(behavior.fuseT).toBe(1.05);
  expect(actions.fuse).toHaveBeenCalledOnce();
  expect(motion.steer).not.toHaveBeenCalled();
  for (let i = 0; i < 10; i++) behavior.update(0.1, target);
  expect(actions.explode).not.toHaveBeenCalled();
  expect(body.vel.x).toBeLessThan(1);
  expect(motion.heading).toBe(target.yaw);
  expect(actions.flash).toHaveBeenCalledTimes(10);
  behavior.update(0.1, target);
  expect(actions.explode).toHaveBeenCalledOnce();
  expect(behavior.fuseT).toBeLessThan(0);
});
it('chooses direct visible pursuit or navigation without arming across occlusion or a different floor', () => {
  const { motion, actions, behavior, target } = fixture();
  target.distance = 10;
  target.position.z = 10;
  behavior.update(0.05, target);
  expect(motion.steer).toHaveBeenCalledWith(0, 10, 6.5, 45, 0.05);
  target.distance = 2;
  target.visible = false;
  behavior.update(0.05, target);
  expect(motion.follow).toHaveBeenCalledOnce();
  target.visible = true;
  target.height = 3;
  behavior.update(0.05, target);
  expect(motion.follow).toHaveBeenCalledTimes(2);
  expect(actions.fuse).not.toHaveBeenCalled();
  expect(behavior.fuseT).toBe(-1);
});
it('accepts mirrored fuse presentation without granting explosion ownership to a renderer', () => {
  const { behavior, actions } = fixture();
  behavior.applyFuse(0.5);
  expect(behavior.fuseT).toBe(0.5);
  expect(actions.explode).not.toHaveBeenCalled();
  behavior.applyFuse(-1);
  expect(behavior.fuseT).toBe(-1);
});
