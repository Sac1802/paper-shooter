// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';

let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});
function setup() {
  vi.useFakeTimers();
  fixture = applicationFixture();
  const { world, player, game } = fixture;
  world.clear();
  world.addBox({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
  world.finalize();
  player.body.pos.set(0, 0, 0);
  player.eye.set(0, 1.6, 0);
  player.center.set(0, 0.9, 0);
  player.forward.set(0, 0, -1);
  game.state = 'play';
  return fixture;
}
function target(x = 0, z = -8, type = 'grunt') {
  const enemy = fixture.enemies.spawn(type, new Vector3(x, 0, z));
  enemy.state = 'hunt';
  enemy.center.set(x, 1.6, z);
  return enemy;
}

it('ranks aim before proximity and filters spawn, dead, range, cone and obscured targets', () => {
  const { app, world } = setup();
  const near = target(3, -5);
  const aligned = target(0, -12);
  target(0, -12);
  const spawning = target(0, -1);
  spawning.state = 'spawn';
  const dead = target(0, -2);
  dead.alive = false;
  target(0, -0.2);
  target(0, -25);
  target(0, 3);
  expect(app.focus.focusCandidate()).toBe(aligned);
  world.addBox({ x: -0.5, y: 0, z: -10 }, { x: 0.5, y: 4, z: -9 });
  world.finalize();
  expect(app.focus.focusCandidate()).toBe(near);
});

it('requires a candidate, stays solo-only and caps the existing two-link focus window', () => {
  const { app, game, audio } = setup();
  const sound = vi.spyOn(audio, 'focusIn');
  app.focus.enterFocus();
  expect(game.focus.active).toBe(false);
  target();
  game.mode = 'ffa';
  app.focus.enterFocus();
  expect(game.focus.active).toBe(false);
  game.mode = 'solo';
  app.focus.enterFocus();
  expect(game.focus).toMatchObject({ active: true, chain: 1, t: 2.6, arm: 0.18, ready: false });
  app.focus.enterFocus();
  expect(game.focus.chain).toBe(2);
  game.focus.t = 1;
  app.focus.enterFocus();
  expect(game.focus.t).toBe(1);
  expect(sound).toHaveBeenCalledOnce();
});

it('requires release and arming before a held dash can start, then consumes fire', () => {
  const { app, input, game } = setup();
  const enemy = target();
  vi.spyOn(input, 'down').mockImplementation((action) => action === 'dash');
  const consumed = vi.spyOn(input, 'consume');
  app.focus.enterFocus();
  app.focus.updateFocus(0.2);
  expect(game.focus.dash).toBeNull();
  vi.mocked(input.down).mockReturnValue(false);
  app.focus.updateFocus(0.01);
  expect(game.focus.ready).toBe(true);
  vi.mocked(input.down).mockImplementation((action) => action === 'dash');
  app.focus.updateFocus(0.01);
  expect(game.focus.dash.target).toBe(enemy);
  expect(consumed).toHaveBeenCalledWith('fire');
});

it('steps over low obstacles and rolls horizontal displacement back at tall obstacles', () => {
  const { app, player, world } = setup();
  world.addBox({ x: 0.5, y: 0, z: -1 }, { x: 1, y: 0.5, z: 1 });
  world.finalize();
  expect(app.focus.marchBody(player.body, 1, 0, 1.5)).toBeCloseTo(1.5);
  expect(player.body.pos.y).toBeCloseTo(0.65);
  player.body.pos.set(0, 0, 0);
  world.addBox({ x: 0.5, y: 0, z: -1 }, { x: 1, y: 4, z: 1 });
  world.finalize();
  const moved = app.focus.marchBody(player.body, 1, 0, 1.5);
  expect(moved).toBeLessThan(0.5);
  expect(player.body.pos.x).toBeCloseTo(moved);
  expect(player.body.pos.y).toBe(0);
});

it('releases expired or dead-target dashes without a slash and preserves velocity on focus cancellation', () => {
  const { app, player, game } = setup();
  const enemy = target();
  const slash = vi.spyOn(player.weapons[player.katanaIndex], 'startSlash');
  app.focus.startFocusDash(enemy);
  app.focus.updateFocusDash(1.21);
  expect(game.focus.dash).toBeNull();
  expect(player.dashLock).toBe(false);
  expect(slash).not.toHaveBeenCalled();
  app.focus.startFocusDash(enemy);
  enemy.alive = false;
  app.focus.updateFocusDash(0.01);
  expect(slash).not.toHaveBeenCalled();
  app.focus.startFocusDash(enemy);
  player.body.vel.set(1, 2, 3);
  app.focus.endFocus();
  expect(player.body.vel).toEqual(new Vector3(1, 2, 3));
  expect(game.focus).toMatchObject({ active: false, dash: null, target: null, chain: 0 });
});

it('turns a blocked dash into a slash only after the existing vertical-stuck delay', () => {
  const { app, player, world, hud } = setup();
  const enemy = target(0, -8);
  enemy.body.pos.y = 5;
  enemy.center.y = 6;
  world.addBox({ x: -2, y: 0, z: -2 }, { x: 2, y: 10, z: -0.4 });
  world.addBox({ x: -2, y: 2, z: -2 }, { x: 2, y: 10, z: 2 });
  world.finalize();
  const slash = vi.spyOn(player.weapons[player.katanaIndex], 'startSlash');
  const tip = vi.spyOn(hud, 'tip');
  app.focus.startFocusDash(enemy);
  expect(app.focus.updateFocusDash(0.05)).toBe(false);
  expect(slash).not.toHaveBeenCalled();
  app.focus.updateFocusDash(0.05);
  expect(slash).toHaveBeenCalledOnce();
  expect(tip).toHaveBeenLastCalledWith('blocked · the dash did not reach', 1.2);
  // The airborne katana slash adds its existing lunge after dash motion stops.
  expect(player.body.vel.length()).toBe(5.5);
  expect(player.dashLock).toBe(false);
});

it('executes damage before feedback/healing and keeps a renewed focus chain alive', () => {
  const { app, game, player, enemies, audio } = setup();
  const enemy = target();
  player.hp = player.maxHp - 10;
  game.focus.active = true;
  game.focus.chain = 1;
  game.focus.t = 2;
  const damage = vi.spyOn(enemies, 'damage').mockImplementation(() => {
    expect(player.hp).toBe(player.maxHp - 10);
    expect(player.dashLock).toBe(false);
    game.focus.chain++;
    game.focus.t = 2.6;
  });
  const sound = vi.spyOn(audio, 'focusSlash');
  app.focus.startFocusDash(enemy);
  app.focus.focusExecute(enemy);
  expect(damage).toHaveBeenCalledWith(
    enemy,
    100000,
    expect.objectContaining({ source: 'focus', crit: true, part: 'head' }),
  );
  expect(sound).toHaveBeenCalledOnce();
  expect(game.focus).toMatchObject({ chain: 2, t: 2.6, dash: null, target: null });
  expect(player.hp).toBe(player.maxHp - 4);
  damage.mockImplementation(() => {});
  app.focus.focusExecute(enemy);
  expect(game.focus.t).toBe(0.35);
  expect(player.hp).toBe(player.maxHp);
});
