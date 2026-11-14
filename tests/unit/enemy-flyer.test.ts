import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { TYPES } from '../../src/domain/enemies.js';
import { World, makeBody } from '../../src/engine/physics.js';
import { FlyerBehavior, type FlyerPorts } from '../../src/gameplay/enemies/flyer-behavior.js';
function fixture() {
  const body = makeBody(new Vector3(0, 5, 0), 0.45, 0.8),
    clock = { remaining: 0 },
    world = new World();
  const sight = vi.spyOn(world, 'hasLineOfSight').mockReturnValue(true),
    ray = vi.spyOn(world, 'raycast').mockReturnValue(null);
  const ports: FlyerPorts = {
    center: new Vector3(0, 5, 0),
    orientation: { heading: 0 },
    world,
    damageModifier: () => 2,
    speedModifier: () => 1,
    stunned: vi.fn(),
    recovered: vi.fn(),
    audio: { flyerDive: vi.fn(), flyerBuzz: vi.fn() },
  };
  const target = {
    alive: true,
    center: new Vector3(0, 1, 0),
    tryBlockMelee: vi.fn(() => false),
    takeDamage: vi.fn(),
    knockback: vi.fn(),
  };
  const behavior = new FlyerBehavior(TYPES.flyer, body, clock, ports, {
    duration: 0,
    orbitDirection: 1,
  });
  return { body, clock, world, sight, ray, ports, target, behavior };
}
it('enters a dive only with a living visible target after cooldown and emits one damage/knockback', () => {
  const { behavior, ports, target, sight, clock } = fixture();
  sight.mockReturnValue(false);
  behavior.update(0.1, target, 1);
  expect(behavior.state).toBe('orbit');
  sight.mockReturnValue(true);
  target.alive = false;
  behavior.update(0.1, target, 1);
  expect(behavior.state).toBe('orbit');
  target.alive = true;
  behavior.update(0.1, target, 1);
  expect(behavior.state).toBe('dive');
  expect(ports.audio.flyerDive).toHaveBeenCalledOnce();
  ports.center.copy(target.center);
  behavior.update(0.1, target, 1);
  expect(target.takeDamage).toHaveBeenCalledWith(20, ports.center);
  expect(target.knockback).toHaveBeenCalledOnce();
  expect(behavior.state).toBe('climb');
  expect(clock.remaining).toBeGreaterThanOrEqual(2.8);
  expect(clock.remaining).toBeLessThanOrEqual(4.2);
  behavior.update(0.1, target, 1);
  expect(target.takeDamage).toHaveBeenCalledOnce();
});
it('preserves the existing parry-to-climb exit order while emitting actor stun and finite recoil', () => {
  const { behavior, ports, target, body } = fixture();
  behavior.update(0.1, target, 1);
  ports.center.copy(target.center);
  body.pos.copy(target.center);
  target.tryBlockMelee.mockReturnValue(true);
  behavior.update(0.1, target, 1);
  expect(ports.stunned).toHaveBeenCalledOnce();
  expect(behavior.state).toBe('climb');
  expect(target.takeDamage).not.toHaveBeenCalled();
  expect(body.vel.y).toBe(-3);
  expect(body.vel.toArray().every(Number.isFinite)).toBe(true);
});
it('recovers a yanked flyer on landing or at the existing stun age deadline', () => {
  const { behavior, ports, target, body, clock } = fixture();
  clock.remaining = 100;
  behavior.stun();
  behavior.update(0.1, target, 0.1);
  expect(behavior.state).toBe('stunned');
  expect(body.vel.y).toBe(-2);
  behavior.update(0.1, target, 3);
  expect(behavior.state).toBe('climb');
  expect(ports.recovered).toHaveBeenCalledOnce();
  behavior.update(1.3, target, 3);
  expect(behavior.state).toBe('orbit');
  body.onGround = true;
  behavior.stun();
  behavior.update(0.1, target, 0.1);
  expect(ports.recovered).toHaveBeenCalledTimes(2);
});
it('bounds acceleration and target speed while querying obstacle and floor avoidance', () => {
  const { behavior, ports, target, body, clock, ray, world } = fixture();
  clock.remaining = 100;
  behavior.update(0.1, target, 1);
  expect(body.vel.length()).toBeCloseTo(2.2);
  for (let i = 0; i < 10; i++) behavior.update(0.1, target, 1);
  expect(body.vel.length()).toBeLessThanOrEqual(6.2 + 1e-10);
  const box = world.addBox({ x: -1, y: 0, z: -1 }, { x: 1, y: 1, z: 1 });
  ray.mockReturnValue({ point: new Vector3(), normal: new Vector3(1, 0, 0), dist: 1, box });
  const before = body.vel.y;
  behavior.update(0.1, target, 1);
  expect(body.vel.y).toBeGreaterThan(before);
  expect(ray).toHaveBeenCalledWith(ports.center, expect.any(Vector3), 3.5);
  expect(ray).toHaveBeenCalledWith(ports.center, expect.any(Vector3), 2.5);
  expect(Number.isFinite(ports.orientation.heading)).toBe(true);
});
it('ends a missed dive on expiry without damage', () => {
  const { behavior, target, clock } = fixture();
  behavior.update(0.1, target, 1);
  behavior.update(1.7, target, 1);
  expect(behavior.state).toBe('climb');
  expect(clock.remaining).toBeGreaterThan(0);
  expect(target.takeDamage).not.toHaveBeenCalled();
});
