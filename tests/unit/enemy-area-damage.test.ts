import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { TYPES } from '../../src/domain/enemies.js';
import { INK } from '../../src/shared/ink.js';
import { EnemyAreaDamage } from '../../src/gameplay/enemies/area-damage.js';
const enemy = (x: number, alive = true) => ({ alive, center: new Vector3(x, 0, 0) });
it('bounds enemy blast range, excludes the owner/dead actors and preserves distance falloff', () => {
  const owner = enemy(0),
    near = enemy(2),
    edge = enemy(4),
    outside = enemy(5),
    dead = enemy(1, false),
    damage = vi.fn();
  const area = new EnemyAreaDamage(
    () => [owner, near, edge, outside, dead],
    () => [],
    { damage, damageModifier: () => 2, feedback: { explosion: vi.fn() } },
  );
  area.blast(new Vector3(), 4, 100, owner);
  expect(damage).toHaveBeenCalledTimes(2);
  expect(damage.mock.calls.map(([actor]) => actor)).toEqual([near, edge]);
  expect(damage.mock.calls[0][1]).toBeCloseTo(70);
  expect(damage.mock.calls[1][1]).toBeCloseTo(40);
  expect(damage.mock.calls[0][2]).toMatchObject({ source: 'blast', part: 'torso', crit: false });
  expect(damage.mock.calls[0][2].point).not.toBe(near.center);
});
it('emits bomber feedback before scaled player damage, with the original strict player boundary and enemy blast', () => {
  const owner = enemy(0),
    victim = enemy(4.2),
    damage = vi.fn(),
    events: string[] = [];
  const target = {
      ...enemy(2.1),
      takeDamage: vi.fn((_amount: number, _from: Vector3) => {
        events.push('player');
      }),
      knockback: vi.fn(),
    },
    edge = { ...enemy(4.2), takeDamage: vi.fn(), knockback: vi.fn() };
  const explosion = vi.fn(() => {
      events.push('effect');
    }),
    area = new EnemyAreaDamage(
      () => [owner, victim],
      () => [target, edge],
      { damage, damageModifier: () => 2, feedback: { explosion } },
    );
  const origin = new Vector3();
  area.bomber(origin, TYPES.bomber, owner, 1);
  expect(explosion).toHaveBeenCalledWith(origin, 4.2, INK.BLACK);
  expect(events).toEqual(['effect', 'player']);
  expect(target.takeDamage.mock.calls[0][0]).toBeCloseTo(24 * 2 * Math.sqrt(0.5));
  expect(target.knockback).toHaveBeenCalledWith(new Vector3(1, 0, 0), 7);
  expect(edge.takeDamage).not.toHaveBeenCalled();
  expect(damage).toHaveBeenCalledOnce();
  expect(damage.mock.calls[0][1]).toBeCloseTo(28);
  expect(origin.toArray()).toEqual([0, 0, 0]);
});
