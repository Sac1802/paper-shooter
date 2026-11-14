import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { TYPES } from '../../src/domain/enemies.js';
import { makeBody } from '../../src/engine/physics.js';
import { BladeBehavior } from '../../src/gameplay/enemies/blade-behavior.js';
import type { PerceivedTarget } from '../../src/gameplay/enemies/perception.js';
function fixture() {
  const body = makeBody(new Vector3(), 0.3, 1.85),
    clock = { remaining: 0 };
  const motion = {
    heading: 0,
    steer: vi.fn(() => 0),
    follow: vi.fn(() => 0),
    approachPoint: vi.fn((_dt: number, position: Vector3, out: Vector3) => out.copy(position)),
    meleeObstacle: vi.fn(),
  };
  const actions = {
    center: new Vector3(0, 1, 0),
    damageModifier: () => 2,
    stun: vi.fn(),
    slash: vi.fn(),
    audio: { lunge: vi.fn(), katanaSwing: vi.fn() },
  };
  const target = { tryBlockMelee: vi.fn(() => false), takeDamage: vi.fn() },
    behavior = new BladeBehavior(TYPES.rusher, body, motion, clock, actions);
  const sensed: PerceivedTarget = {
    position: new Vector3(0, 0, 2),
    center: new Vector3(0, 1, 2),
    dx: 0,
    dz: 2,
    distance: 2,
    height: 0,
    yaw: 0.4,
    visible: true,
  };
  return { body, clock, motion, actions, target, behavior, sensed };
}
it('telegraphs before one hit, then retreats without repeating damage in the same swing', () => {
  const { behavior, actions, target, clock, sensed, motion } = fixture();
  behavior.update(0.05, sensed, target);
  expect(behavior.attackT).toBe(0.55);
  expect(actions.audio.lunge).toHaveBeenCalledOnce();
  expect(actions.slash).not.toHaveBeenCalled();
  behavior.update(0.4, sensed, target);
  expect(actions.slash).toHaveBeenCalledOnce();
  expect(target.takeDamage).toHaveBeenCalledWith(30, actions.center);
  expect(clock.remaining).toBeGreaterThanOrEqual(1);
  behavior.update(0.1, sensed, target);
  expect(motion.heading).toBe(sensed.yaw);
  expect(target.takeDamage).toHaveBeenCalledOnce();
  expect(actions.slash).toHaveBeenCalledOnce();
});
it('emits a stun and finite recoil when a defender parries a strike', () => {
  const { behavior, actions, target, body, sensed } = fixture();
  target.tryBlockMelee.mockReturnValue(true);
  behavior.update(0.05, sensed, target);
  behavior.update(0.4, sensed, target);
  expect(actions.stun).toHaveBeenCalledWith(1.1);
  expect(target.takeDamage).not.toHaveBeenCalled();
  expect(body.vel.y).toBe(3.5);
  expect(body.vel.z).toBe(-7);
  expect(body.vel.toArray().every(Number.isFinite)).toBe(true);
});
it('completes a missed strike and its cooldown without applying damage across height separation', () => {
  const { behavior, actions, target, clock, sensed } = fixture();
  behavior.update(0.05, sensed, target);
  sensed.height = 2;
  behavior.update(0.4, sensed, target);
  expect(actions.audio.katanaSwing).toHaveBeenCalledOnce();
  expect(target.takeDamage).not.toHaveBeenCalled();
  expect(clock.remaining).toBeGreaterThan(0);
  expect(actions.slash).toHaveBeenCalledOnce();
});
it('preserves route/formation pursuit, obstacle recovery and mirrored attack presentation', () => {
  const { behavior, body, motion, sensed, target } = fixture();
  sensed.distance = 6;
  sensed.position.z = 6;
  body.onGround = true;
  body.hitWall = true;
  behavior.update(0.05, sensed, target);
  expect(motion.approachPoint).toHaveBeenCalledOnce();
  expect(motion.steer).toHaveBeenCalledWith(0, 6, 7.6, 45, 0.05);
  expect(motion.meleeObstacle).toHaveBeenCalledWith(0.05);
  sensed.visible = false;
  behavior.update(0.05, sensed, target);
  expect(motion.follow).toHaveBeenCalledOnce();
  behavior.applyAttackTime(0.3);
  expect(behavior.attackT).toBe(0.3);
});
it('backs off at standoff range while cooling down and keeps coincident coordinates finite', () => {
  const { behavior, clock, body, sensed, target, motion } = fixture();
  clock.remaining = 1;
  sensed.distance = 1;
  sensed.position.z = 1;
  sensed.dz = 1;
  behavior.update(0.05, sensed, target);
  expect(body.vel.z).toBeLessThan(0);
  expect(motion.heading).toBe(sensed.yaw);
  sensed.distance = sensed.dx = sensed.dz = 0;
  behavior.update(0.05, sensed, target);
  expect(body.vel.toArray().every(Number.isFinite)).toBe(true);
});
