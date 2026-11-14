import { expect, it, vi } from 'vitest';
import { Group, Vector3 } from 'three';
import { makeBody } from '../../src/engine/physics.js';
import { EnemySimulation, type SimulatedEnemy } from '../../src/gameplay/enemies/simulation.js';
import type { EnemyTarget } from '../../src/gameplay/enemies/actor-contracts.js';
function actor(): SimulatedEnemy {
  return {
    t: 0,
    alive: true,
    state: 'hunt',
    stunDur: 0.5,
    yaw: 0,
    body: makeBody(new Vector3(0, 2, 0), 0.35, 1.85),
    T: { scale: 1, flying: false },
    root: new Group(),
    navigation: { heading: 0 },
    hitFeedback: { update: vi.fn() },
    telegraph: { hide: vi.fn() },
    flyer: null,
    updateDead: vi.fn(),
    think: vi.fn(),
    idle: vi.fn(),
    animate: vi.fn(),
    syncHit: vi.fn(),
  };
}
function fixture() {
  const actors = [actor()],
    world = { moveBody: vi.fn(), overlapsBody: vi.fn(() => false) },
    target: EnemyTarget = {
      alive: true,
      body: { pos: new Vector3(20, 0, 0) },
      center: new Vector3(20, 1, 0),
      speed: 0,
      takeDamage: vi.fn(),
      knockback: vi.fn(),
      tryBlockMelee: () => false,
    };
  const ports = { target: () => target, kill: vi.fn() },
    simulation = new EnemySimulation(() => actors, world, ports);
  return { actors, world, target, ports, simulation };
}
it('finishes spawn presentation before beginning movement and keeps the old finalization order', () => {
  const { actors, world, simulation } = fixture(),
    enemy = actors[0];
  enemy.state = 'spawn';
  enemy.root.scale.setScalar(0.001);
  vi.mocked(enemy.syncHit).mockImplementation(() => {
    if (enemy.t <= 0.6) expect(enemy.state).toBe('spawn');
  });
  simulation.update(0.5);
  expect(enemy.state).toBe('spawn');
  expect(enemy.root.scale.x).toBeGreaterThan(0);
  expect(world.moveBody).not.toHaveBeenCalled();
  simulation.update(0.1);
  expect(enemy.state).toBe('hunt');
  expect(enemy.root.scale.x).toBe(1);
  expect(enemy.think).not.toHaveBeenCalled();
  simulation.update(0.05);
  expect(enemy.think).toHaveBeenCalledOnce();
  expect(world.moveBody).toHaveBeenCalledOnce();
});
it('recovers a stun without thinking in that same frame and idles when its target dies', () => {
  const { actors, target, simulation } = fixture(),
    enemy = actors[0];
  enemy.state = 'stunned';
  enemy.stunDur = 0.05;
  simulation.update(0.1);
  expect(enemy.state).toBe('hunt');
  expect(enemy.telegraph.hide).toHaveBeenCalledOnce();
  expect(enemy.think).not.toHaveBeenCalled();
  simulation.update(0.05);
  expect(enemy.think).toHaveBeenCalledOnce();
  target.alive = false;
  simulation.update(0.05);
  expect(enemy.idle).toHaveBeenCalledOnce();
});
it('retains pose-before-target-separation ordering and rolls back pushes into solid geometry', () => {
  const { actors, target, world, simulation } = fixture(),
    enemy = actors[0];
  enemy.body.pos.set(0.5, 0, 0);
  target.body.pos.set(0, 0, 0);
  simulation.update(0.05);
  expect(enemy.body.pos.x).toBeCloseTo(0.83);
  expect(enemy.root.position.x).toBe(0.5);
  expect(enemy.animate).toHaveBeenCalledOnce();
  expect(enemy.syncHit).toHaveBeenCalledOnce();
  world.overlapsBody.mockReturnValue(true);
  enemy.body.pos.x = 0.5;
  simulation.update(0.05);
  expect(enemy.body.pos.x).toBeCloseTo(0.5);
});
it('limits pair separation cadence while preserving opposing velocity impulses', () => {
  const { actors, simulation } = fixture(),
    second = actor();
  actors[0].body.pos.set(0, 2, 0);
  second.body.pos.set(1, 2, 0);
  actors.push(second);
  simulation.update(0.01);
  expect(actors[0].body.vel.x).toBeCloseTo(-4.05);
  expect(second.body.vel.x).toBeCloseTo(4.05);
  simulation.update(0.01);
  expect(second.body.vel.x).toBeCloseTo(4.05);
  simulation.update(0.05);
  expect(second.body.vel.x).toBeCloseTo(8.1);
});
it('advances corpses without AI and requests falls before animation', () => {
  const { actors, ports, world, simulation } = fixture(),
    enemy = actors[0];
  enemy.alive = false;
  simulation.update(0.05);
  expect(enemy.updateDead).toHaveBeenCalledWith(0.05);
  expect(world.moveBody).not.toHaveBeenCalled();
  enemy.alive = true;
  enemy.body.pos.y = -7;
  simulation.update(0.05);
  expect(ports.kill).toHaveBeenCalledWith(enemy, { source: 'fall', dir: new Vector3(0, 1, 0) });
  expect(enemy.animate).not.toHaveBeenCalled();
});
it('processes actors appended by a summon in the same frame and leaves flying gravity to their behavior', () => {
  const { actors, world, simulation } = fixture(),
    child = actor();
  child.T.flying = true;
  child.body.vel.y = 1;
  child.flyer = { update: vi.fn() };
  vi.mocked(actors[0].think).mockImplementation(() => {
    actors.push(child);
  });
  simulation.update(0.05);
  expect(child.flyer.update).toHaveBeenCalledOnce();
  expect(child.think).not.toHaveBeenCalled();
  expect(child.body.vel.y).toBe(1);
  expect(world.moveBody).toHaveBeenCalledTimes(2);
});
