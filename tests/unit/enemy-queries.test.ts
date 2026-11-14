import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import {
  EnemyQueries,
  type SpatialEnemy,
  type TargetPose,
} from '../../src/gameplay/enemies/queries.js';
function enemy(
  x: number,
  z: number,
): SpatialEnemy & { target?: TargetPose | null; retargetT?: number } {
  const center = new Vector3(x, 1, z);
  return {
    alive: true,
    center,
    body: { pos: new Vector3(x, 0, z) },
    T: { scale: 1 },
    hit: [
      ['head', 0.3],
      ['torso', 0.5],
    ],
    hitSpheres: [center.clone().add(new Vector3(0, 0.6, 0)), center],
  };
}
function target(z: number): TargetPose {
  return { alive: true, body: { pos: new Vector3(0, 0, z) }, center: new Vector3(0, 1, z) };
}
it('retains a living target until its refresh deadline and immediately replaces a dead target', () => {
  const entity = enemy(0, 0),
    first = target(2),
    second = target(4),
    targets = [first, second];
  const queries = new EnemyQueries(
    () => [entity],
    () => targets,
    { hasLineOfSight: () => true },
  );
  expect(queries.pickTarget(entity, 0)).toBe(first);
  second.body.pos.z = 1;
  expect(queries.pickTarget(entity, 0.1)).toBe(first);
  expect(queries.pickTarget(entity, 0.4)).toBe(second);
  second.alive = false;
  expect(queries.pickTarget(entity, 0)).toBe(first);
  first.alive = false;
  expect(queries.pickTarget(entity, 0)).toBeNull();
  expect(queries.nearestTarget(new Vector3())).toBeNull();
});
it('excludes occluded, dead, distant and rear targets from aim selection', () => {
  const rear = enemy(0, 2),
    far = enemy(0, -30),
    near = enemy(0, -3),
    hidden = enemy(0, -2),
    dead = enemy(0, -1);
  dead.alive = false;
  const world = { hasLineOfSight: vi.fn((_from: Vector3, to: Vector3) => to !== hidden.center) };
  const queries = new EnemyQueries(
    () => [rear, far, near, hidden, dead],
    () => [],
    world,
  );
  expect(queries.nearestVisible(new Vector3(0, 1, 0), new Vector3(0, 0, -1), 0.9, 20)).toBe(near);
  expect(world.hasLineOfSight).toHaveBeenCalledTimes(2);
});
it('resolves the closest hit region and honors ignored entities, range and boss melee reach', () => {
  const near = enemy(0, -3),
    far = enemy(0, -5);
  near.hit.unshift(['shield', 0.6]);
  near.hitSpheres.unshift(new Vector3(0, 1, -2.5));
  const queries = new EnemyQueries(
    () => [far, near],
    () => [],
    { hasLineOfSight: () => true },
  );
  const origin = new Vector3(0, 1, 0),
    forward = new Vector3(0, 0, -1);
  expect(queries.raycast(origin, forward, 10)).toMatchObject({
    enemy: near,
    part: 'shield',
    dist: 1.9,
  });
  expect(queries.raycast(origin, forward, 10, near)?.enemy).toBe(far);
  expect(queries.raycast(origin, forward, 1)).toBeNull();
  far.T.boss = true;
  expect(queries.inArc(origin, forward, 4, 0.9).map((hit) => hit.enemy)).toEqual([near, far]);
});
