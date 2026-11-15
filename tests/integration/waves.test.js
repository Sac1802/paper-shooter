// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';

let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
});
it('preserves wave supplies, boss scaling, checkpoints and the eight-second intermission', () => {
  fixture = applicationFixture('mexico');
  const { app, game, state, player, enemies, values } = fixture;
  player.grenades = 0;
  app.waves.startWave(1);
  expect(game.queue).toEqual(Array(7).fill('grunt'));
  expect(game).toMatchObject({ wave: 1, spawnT: 2, maxAlive: 4, intermission: 0 });
  expect(enemies.mods).toEqual({ speed: 1, damage: 1.2 });
  expect(state.pickups.map((pickup) => pickup.kind)).toEqual([
    'ammo',
    'ammo',
    'ammo',
    'ammo',
    'ammo',
    'health',
    'health',
  ]);
  expect(player.grenades).toBe(1);
  app.waves.startWave(5);
  expect(game.queue[0]).toBe('boss');
  expect(state.checkpoint).toBe(5);
  expect(values.get('paper_checkpoint')).toBe('5');
  app.waves.startWave(20);
  app.waves.updateWaves(2);
  const boss = enemies.enemies[0];
  expect(boss.T.boss).toBe(true);
  expect(boss.hp).toBe(Math.round(boss.T.hp * 1.35));
  expect(boss.maxHp).toBe(boss.hp);
  enemies.clear();
  game.queue = [];
  player.hp = player.maxHp - 30;
  app.waves.updateWaves(0.1);
  expect(game.intermission).toBe(8);
  expect(game.score).toBe(4000);
  expect(player.hp).toBe(player.maxHp);
  app.waves.updateWaves(7.9);
  expect(game.wave).toBe(20);
  app.waves.updateWaves(0.2);
  expect(game.wave).toBe(21);
  expect(game.intermission).toBe(0);
});

it('preserves hidden/distant spawns, sniper locations, flyer bounds and bounded boss fallback', () => {
  fixture = applicationFixture();
  const { app, state, player, world } = fixture;
  player.body.pos.set(0, 0, 0);
  player.eye.set(0, 1.6, 0);
  state.level.spawns = [5, 16, 22, 60].map((x) => new Vector3(x, 0, 0));
  state.level.snipers = [new Vector3(-25, 4, 0)];
  state.level.bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const visibility = vi
    .spyOn(world, 'hasLineOfSight')
    .mockImplementation((_eye, target) => target.x !== 22);
  expect(app.waves.pickSpawn('grunt')).toEqual(new Vector3(22, 0, 0));
  visibility.mockReturnValue(true);
  expect(app.waves.pickSpawn('grunt')).toEqual(new Vector3(16, 0, 0));
  expect(app.waves.pickSpawn('sniper')).toEqual(new Vector3(-25, 4, 0));
  expect(app.waves.pickSpawn('flyer')).toEqual(new Vector3(6, 12, 0));
  const overlap = vi.spyOn(world, 'overlapsAABB').mockReturnValue(false);
  expect(app.waves.pickSpawn('boss')).toEqual(new Vector3(22, 0, 0));
  state.level.spawns = [new Vector3(16, 0, 0)];
  expect(app.waves.pickSpawn('eraser')).toEqual(new Vector3(16, 0, 0));
  overlap.mockReturnValue(true);
  const ground = vi.spyOn(world, 'groundBelow').mockReturnValue(-10);
  expect(app.waves.pickSpawn('inkblot')).toEqual(state.level.playerStart);
  expect(ground).toHaveBeenCalledTimes(200);
  ground.mockReturnValue(2);
  overlap.mockReturnValueOnce(true).mockReturnValue(false);
  expect(app.waves.pickSpawn('boss')).toEqual(new Vector3(22, 2, 0));
  state.level.spawns = [new Vector3(5, 0, 0)];
  expect(app.waves.pickSpawn('grunt')).toEqual(new Vector3(5, 0, 0));
});

it('preserves ordered kill bonuses, focus charging, labels and loot thresholds', () => {
  fixture = applicationFixture();
  const { app, game, player, enemies, hud, state } = fixture;
  const entered = vi.spyOn(app.focus, 'enterFocus').mockImplementation(() => {});
  const blade = player.weapons[player.katanaIndex];
  const blood = vi.spyOn(blade, 'addBlood');
  const kill = vi.spyOn(hud, 'kill');
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
  const enemy = {
    T: { name: 'GRUNT', score: 100, boss: false },
    body: { pos: new Vector3(30, 1, 30) },
  };
  const cases = [
    ['rifle', true, false, true, 160, 'HEADSHOT', 0],
    ['katana', false, true, true, 150, 'SLICED', 3],
    ['katana', true, false, false, 250, 'CUT DOWN · AIRBORNE', 3],
    ['focus', true, false, false, 350, 'EXECUTED · AIRBORNE', 3],
    ['deflect', true, false, false, 280, 'RETURN TO SENDER', 0],
    ['fall', false, false, false, 100, 'FELL OFF THE PAGE', 0],
    ['blast', false, false, true, 100, 'GRUNT', 2],
    ['rifle', false, false, false, 140, 'GRUNT · AIRBORNE', 0],
  ];
  for (const [source, crit, severed, grounded, points, label, streak] of cases) {
    Object.assign(game, { score: 0, combo: 0, kills: 0, katanaStreak: 2 });
    player.body.onGround = grounded;
    enemies.onKill(enemy, { source, crit }, severed);
    expect(game).toMatchObject({
      kills: 1,
      combo: 1,
      comboT: 3.5,
      katanaStreak: streak,
      score: Math.round(points * 1.25),
    });
    expect(kill).toHaveBeenLastCalledWith(label, Math.round(points * 1.25));
  }
  expect(entered).toHaveBeenCalledTimes(3);
  expect(blood).toHaveBeenCalledTimes(3);
  expect(blood).toHaveBeenLastCalledWith(0.42);
  for (const [roll, kind] of [
    [0.499, 'ammo'],
    [0.5, 'health'],
    [0.619, 'health'],
    [0.62, null],
  ]) {
    const before = state.pickups.length;
    random.mockReturnValue(roll);
    enemies.onKill(enemy, { source: 'rifle', crit: false }, false);
    expect(state.pickups.length).toBe(before + (kind ? 1 : 0));
    if (kind) expect(state.pickups.at(-1)).toMatchObject({ kind });
  }
});
