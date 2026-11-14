import { expect, it, vi } from 'vitest';
import { Vector3, Scene } from 'three';
import { World } from '../../src/engine/physics.js';
import { Projectiles } from '../../src/gameplay/projectiles.js';
import { ProjectileView } from '../../src/presentation/projectiles.js';
import type {
  ProjectileEnemy,
  ProjectilePorts,
  ProjectileTarget,
  ProjectileShot,
} from '../../src/gameplay/projectile-contracts.js';
function fixture() {
  const player: ProjectileTarget = {
    alive: true,
    isLocal: true,
    center: new Vector3(0, 1, 0),
    eye: new Vector3(0, 1.6, 0),
    forward: new Vector3(0, 0, -1),
    blockRadius: 0,
    takeDamage: vi.fn(),
    knockback: vi.fn(),
    tryDeflect: vi.fn(() => false as const),
  };
  const enemy: ProjectileEnemy = { id: 10, alive: true, center: new Vector3(0, 1, -4) };
  const world = new World();
  let next = 11;
  const targets = [player];
  const ports: ProjectilePorts<ProjectileEnemy> = {
    world,
    player: () => player,
    targets: () => targets,
    allocateId: () => next++,
    authoritative: vi.fn(() => true),
    queries: { nearestVisible: vi.fn(() => enemy), raycast: vi.fn(() => null) },
    damage: vi.fn(),
    blast: vi.fn(),
    effects: { sparks: vi.fn(), strokeBurst: vi.fn(), explosion: vi.fn(), bulletImpact: vi.fn() },
    audio: { explosion: vi.fn(), bulletImpact: vi.fn() },
  };
  const view = new ProjectileView(new Scene(), 240);
  const projectiles = new Projectiles(ports, view);
  const fire = (options: Partial<ProjectileShot<ProjectileEnemy>> = {}) =>
    projectiles.fire(new Vector3(0, 1, -2), new Vector3(0, 0, 1), {
      speed: 10,
      damage: 5,
      owner: enemy,
      ...options,
    });
  return { player, enemy, world, ports, view, projectiles, fire, targets };
}
it('lets world geometry consume a projectile before players or reflected enemies', () => {
  const { world, player, ports, fire, projectiles, view } = fixture();
  world.addBox({ x: -1, y: 0, z: -1.5 }, { x: 1, y: 2, z: -1 });
  world.finalize();
  fire();
  projectiles.update(0.2);
  expect(player.takeDamage).not.toHaveBeenCalled();
  expect(ports.queries.raycast).not.toHaveBeenCalled();
  expect(ports.effects.bulletImpact).toHaveBeenCalledOnce();
  expect(projectiles.list).toHaveLength(0);
  expect(view.mesh.count).toBe(0);
});
it('consumes hits on remote players without applying their damage on this peer', () => {
  const { player, fire, projectiles, view } = fixture();
  player.isLocal = false;
  fire();
  projectiles.update(0.2);
  expect(player.takeDamage).not.toHaveBeenCalled();
  expect(player.tryDeflect).not.toHaveBeenCalled();
  expect(projectiles.list).toHaveLength(0);
  expect(view.mesh.count).toBe(0);
});
it('returns perfect blocks to their living owner and defers enemy impact to the next frame', () => {
  const { player, ports, fire, projectiles, enemy, view } = fixture();
  vi.mocked(player.tryDeflect).mockReturnValue({ ret: true, perfect: true });
  const shot = fire();
  projectiles.update(0.2);
  expect(projectiles.list).toEqual([shot]);
  expect(shot.dmg).toBe(17.5);
  expect(shot.vel.z).toBe(-16);
  expect(ports.queries.nearestVisible).not.toHaveBeenCalled();
  expect(ports.queries.raycast).not.toHaveBeenCalled();
  expect(view.mesh.count).toBe(1);
  expect(Array.from(view.mesh.instanceMatrix.array).slice(0, 16).every(Number.isFinite)).toBe(true);
  vi.mocked(ports.queries.raycast).mockReturnValue({
    enemy,
    part: 'head',
    point: enemy.center,
    dist: 1,
  });
  projectiles.update(0.1);
  expect(ports.damage).toHaveBeenCalledWith(
    enemy,
    17.5,
    expect.objectContaining({ source: 'deflect', crit: true }),
  );
  expect(projectiles.list).toHaveLength(0);
});
it('uses the wider guard catch without damaging a player missed by the narrower body radius', () => {
  const { player, projectiles, fire } = fixture();
  player.blockRadius = 0.95;
  player.center.x = 0.8;
  player.eye.x = 0.8;
  fire();
  projectiles.update(0.2);
  expect(player.tryDeflect).toHaveBeenCalledOnce();
  expect(player.takeDamage).not.toHaveBeenCalled();
  expect(projectiles.list).toHaveLength(1);
});
it.each([true, false])(
  'applies local blast damage but only the authority damages enemies (%s)',
  (authority) => {
    const { ports, player, projectiles, fire, enemy } = fixture();
    vi.mocked(ports.authoritative).mockReturnValue(authority);
    fire({ blast: 1 });
    projectiles.update(0.2);
    expect(player.takeDamage).toHaveBeenCalledOnce();
    expect(player.knockback).toHaveBeenCalledOnce();
    expect(ports.effects.explosion).toHaveBeenCalledOnce();
    if (authority) expect(ports.blast).toHaveBeenCalledWith(expect.any(Vector3), 3.5, 7.5, enemy);
    else expect(ports.blast).not.toHaveBeenCalled();
  },
);
it('shares allocated IDs, preserves replicated IDs and bounds projectile lifetime/capacity', () => {
  const { projectiles, fire, view } = fixture();
  projectiles.onFire = vi.fn();
  expect(fire().id).toBe(11);
  expect(fire({ id: 90 }).id).toBe(90);
  expect(fire().id).toBe(12);
  expect(projectiles.onFire).toHaveBeenCalledTimes(2);
  for (let i = 0; i < 250; i++) fire();
  expect(projectiles.list).toHaveLength(240);
  projectiles.update(5);
  expect(projectiles.list).toHaveLength(0);
  expect(view.mesh.count).toBe(0);
  fire();
  projectiles.clear();
  expect(projectiles.list).toHaveLength(0);
});
