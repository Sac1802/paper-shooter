import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { PlayerQueries, type PlayerQueryTarget } from '../../src/gameplay/combat/player-queries.js';
function target(z: number, blocking = false): PlayerQueryTarget {
  return {
    alive: true,
    blocking,
    center: new Vector3(0, 1, z),
    forward: new Vector3(0, 0, 1),
    hit: [['torso', 0.33]],
    hitSpheres: [new Vector3(0, 1.25, z)],
  };
}
const origin = new Vector3(0, 1.25, 0),
  direction = new Vector3(0, 0, -1);
it('orders body and guard hits across targets independently from iteration order', () => {
  const near = target(-3),
    far = target(-8, true);
  for (const targets of [
    [near, far],
    [far, near],
  ]) {
    const query = new PlayerQueries(
      () => targets,
      () => true,
      { hasLineOfSight: () => true },
    );
    expect(query.raycast(origin, direction, 30)?.player).toBe(near);
    expect(query.raycast(origin, direction, 1)).toBeNull();
  }
});
it('lets a nearer raised blade intercept a ray and excludes dead or ineligible players', () => {
  const guard = target(-3, true);
  const eligible = vi.fn(() => true);
  const query = new PlayerQueries(() => [guard], eligible, { hasLineOfSight: () => true });
  expect(query.raycast(origin, direction, 30)).toMatchObject({ player: guard, part: 'blade' });
  eligible.mockReturnValue(false);
  expect(query.raycast(origin, direction, 30)).toBeNull();
  eligible.mockReturnValue(true);
  Object.assign(guard, { alive: false });
  expect(query.raycast(origin, direction, 30)).toBeNull();
});
it('filters arcs by permission, reach, direction and visibility without moving target centers', () => {
  const near = target(-2),
    far = target(-20),
    behind = target(2),
    hidden = target(-3);
  const world = { hasLineOfSight: vi.fn((_from: Vector3, to: Vector3) => to !== hidden.center) };
  const query = new PlayerQueries(
    () => [near, far, behind, hidden],
    () => true,
    world,
  );
  expect(query.inArc(origin, direction, 5, 0.7)).toEqual([near]);
  expect(near.center).toEqual(new Vector3(0, 1, -2));
  expect(origin).toEqual(new Vector3(0, 1.25, 0));
  expect(direction).toEqual(new Vector3(0, 0, -1));
});
