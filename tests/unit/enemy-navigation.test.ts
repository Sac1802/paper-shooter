import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { makeBody, World } from '../../src/engine/physics.js';
import {
  EnemyNavigation,
  type NavigationPort,
  type NavigationRoute,
} from '../../src/gameplay/enemies/navigation.js';
function route(points: Vector3[], complete = true): NavigationRoute {
  return Object.assign(points, { complete });
}
function fixture() {
  const body = makeBody(new Vector3(), 0.35, 1.85);
  body.onGround = true;
  const world = new World();
  let speed = 1;
  const findPath = vi.fn((_from: Vector3, to: Vector3) => route([to.clone()]));
  let navigation: NavigationPort = { findPath };
  const movement = new EnemyNavigation(
    body,
    { world, navigation: () => navigation, speed: () => speed },
    { weapon: 'rifle', angle: 0, delay: 100 },
  );
  return {
    body,
    world,
    movement,
    findPath,
    setSpeed: (value: number) => {
      speed = value;
    },
    replaceNavigation: (value: NavigationPort) => {
      navigation = value;
    },
  };
}
it('bounds acceleration, applies the speed modifier and damps coincident steering without a heading', () => {
  const { body, movement, setSpeed } = fixture();
  expect(movement.steer(10, 0, 10, 20, 0.1)).toBe(Math.PI / 2);
  expect(body.vel.x).toBe(2);
  body.vel.set(0, 0, 0);
  body.onGround = false;
  movement.steer(10, 0, 10, 20, 0.1);
  expect(body.vel.x).toBeCloseTo(0.6);
  body.onGround = true;
  setSpeed(0.5);
  movement.steer(10, 0, 10, 100, 1);
  expect(body.vel.x).toBe(5);
  expect(movement.steer(0, 0, 10, 100, 0.1)).toBeNull();
  expect(body.vel.x).toBeGreaterThan(0);
  expect(body.vel.x).toBeLessThan(5);
  expect(body.vel.toArray().every(Number.isFinite)).toBe(true);
});
it('reuses complete routes, retries incomplete routes after the deadline and adopts a replaced grid', () => {
  const { movement, findPath, replaceNavigation } = fixture(),
    target = new Vector3(10, 0, 0);
  movement.follow(0.05, target, 5);
  movement.follow(2, target, 5);
  expect(findPath).toHaveBeenCalledOnce();
  findPath.mockReturnValue(route([target.clone()], false));
  movement.invalidate();
  movement.follow(0.05, target, 5);
  movement.follow(2, target, 5);
  expect(findPath).toHaveBeenCalledTimes(3);
  const replacement = vi.fn(() => route([new Vector3(5, 0, 0)]));
  replaceNavigation({ findPath: replacement });
  movement.invalidate();
  movement.follow(0.05, target, 5);
  expect(replacement).toHaveBeenCalledOnce();
});
it('steps toward higher waypoints and recovers a blocked route without airborne jumps', () => {
  const { body, movement, findPath } = fixture();
  findPath.mockReturnValue(route([new Vector3(0, 1, 1)]));
  movement.follow(0.05, new Vector3(0, 1, 5), 5);
  expect(body.vel.y).toBe(9);
  expect(body.onGround).toBe(false);
  body.vel.y = 0;
  movement.follow(0.05, new Vector3(0, 1, 5), 5);
  expect(body.vel.y).toBe(0);
  body.onGround = true;
  body.hitWall = true;
  findPath.mockReturnValue(route([new Vector3(0, 0, 5)]));
  movement.invalidate();
  for (let i = 0; i < 10; i++) movement.follow(0.1, new Vector3(0, 0, 10), 5);
  expect(body.vel.y).toBe(9);
  expect(body.onGround).toBe(false);
});
it('checks ground ahead against the active world and keeps close-melee recovery state per body', () => {
  const { body, world, movement } = fixture();
  world.addBox({ x: -2, y: -1, z: -2 }, { x: 2, y: 0, z: 2 });
  world.finalize();
  expect(movement.groundAhead(1, 0)).toBe(true);
  expect(movement.groundAhead(5, 0)).toBe(false);
  movement.meleeObstacle(0.2);
  expect(body.vel.y).toBe(0);
  movement.meleeObstacle(0.1);
  expect(body.vel.y).toBe(9);
  const other = fixture();
  other.movement.meleeObstacle(0.1);
  expect(other.body.vel.y).toBe(0);
});
