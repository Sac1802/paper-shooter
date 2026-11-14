import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { TYPES } from '../../src/domain/enemies.js';
import { makeBody } from '../../src/engine/physics.js';
import { RangedBehavior } from '../../src/gameplay/enemies/ranged-behavior.js';
import type { PerceivedTarget } from '../../src/gameplay/enemies/perception.js';
function fixture(kind: 'grunt' | 'heavy' | 'sniper' = 'grunt') {
  const body = makeBody(new Vector3(), 0.3, 1.85),
    motion = {
      heading: 0,
      steer: vi.fn(() => 0),
      follow: vi.fn(() => 0),
      groundAhead: vi.fn(() => true),
    };
  const attack = { shoot: vi.fn(), interrupt: vi.fn() },
    options = {
      attack,
      localSpeed: () => 8,
      keepMultiplier: 1,
      strafeDirection: 1,
      strafeDuration: 1,
    };
  const behavior = new RangedBehavior(TYPES[kind], body, motion, options);
  const target: PerceivedTarget = {
    position: new Vector3(0, 0, 10),
    center: new Vector3(0, 1, 10),
    dx: 0,
    dz: 10,
    distance: 10,
    height: 0,
    yaw: 0.4,
    visible: true,
  };
  return { body, motion, attack, behavior, target };
}
it('keeps a mid-range firing angle and strafes only above safe ground', () => {
  const { body, motion, attack, behavior, target } = fixture();
  behavior.update(0.1, target, 2, 10);
  expect(body.vel.x).toBeLessThan(0);
  expect(motion.groundAhead).toHaveBeenCalledOnce();
  expect(motion.heading).toBe(target.yaw);
  expect(behavior.aimAmt).toBeGreaterThan(0);
  expect(attack.shoot).toHaveBeenCalledWith(0.1, target.center, 2);
  body.vel.set(0, 0, 0);
  motion.groundAhead.mockReturnValue(false);
  behavior.update(0.1, target, 2, 10);
  expect(body.vel.x).toBe(0);
});
it('routes to distant or elevated targets while preserving their existing dispersion-speed precedence', () => {
  const { motion, attack, behavior, target } = fixture();
  target.distance = 20;
  target.position.z = 20;
  behavior.update(0.1, target, 20, 10);
  expect(motion.follow).toHaveBeenLastCalledWith(0.1, target.position, 5.2 * 0.8);
  expect(attack.shoot).toHaveBeenLastCalledWith(0.1, target.center, 20);
  target.distance = 10;
  target.height = 3;
  behavior.update(0.1, target, 20, 10);
  expect(motion.follow).toHaveBeenLastCalledWith(0.1, target.position, 5.2 * 0.85);
  expect(attack.shoot).toHaveBeenLastCalledWith(0.1, target.center, 8);
});
it('retreats at close range and keeps coincident spacing finite', () => {
  const { body, behavior, target } = fixture();
  target.distance = 2;
  target.dz = 2;
  behavior.update(0.1, target, 0, 10);
  expect(body.vel.z).toBeLessThan(0);
  target.dx = target.dz = target.distance = 0;
  behavior.update(0.1, target, 0, 10);
  expect(body.vel.toArray().every(Number.isFinite)).toBe(true);
});
it('holds the sniper briefly while occluded, then navigates and interrupts pending aim/fire', () => {
  const { motion, attack, behavior, target, body } = fixture('sniper');
  target.visible = false;
  body.vel.set(5, 0, 5);
  behavior.applyAim(1);
  behavior.update(0.1, target, 0, 1);
  expect(motion.follow).not.toHaveBeenCalled();
  expect(body.vel.x).toBeLessThan(5);
  expect(behavior.aimAmt).toBeLessThan(1);
  behavior.update(0.1, target, 0, 6);
  expect(motion.follow).toHaveBeenCalledWith(0.1, target.position, 3.6);
  expect(attack.interrupt).toHaveBeenCalledTimes(2);
  expect(attack.shoot).not.toHaveBeenCalled();
  target.visible = true;
  target.height = 3;
  behavior.update(0.1, target, 20, 10);
  expect(attack.shoot).toHaveBeenLastCalledWith(0.1, target.center, 20);
  expect(motion.groundAhead).not.toHaveBeenCalled();
});
it('idles without shooting when all targets are dead and accepts mirrored aim without driving attacks', () => {
  const { body, behavior, attack } = fixture();
  behavior.applyAim(0.8);
  body.vel.set(5, 0, 5);
  behavior.idle(0.1);
  expect(body.vel.x).toBeLessThan(5);
  expect(behavior.aimAmt).toBeLessThan(0.8);
  expect(attack.shoot).not.toHaveBeenCalled();
});
