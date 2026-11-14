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
it('retires an enemy death once without negative population or duplicate rewards', () => {
  vi.useFakeTimers();
  fixture = applicationFixture();
  fixture.app.controls.begin();
  const { enemies } = fixture;
  const enemy = enemies.spawn('grunt', new Vector3(0, 0, -4)),
    onKill = vi.spyOn(enemies, 'onKill');
  const impact = { source: 'rifle', dir: new Vector3(0, 1, 0), crit: false };
  enemies.kill(enemy, impact);
  enemies.kill(enemy, impact);
  expect(enemies.alive).toBe(0);
  expect(onKill).toHaveBeenCalledOnce();
});

it('ignores a queued hit against an enemy from a cleared population', () => {
  vi.useFakeTimers();
  fixture = applicationFixture();
  fixture.app.controls.begin();
  const { enemies, effects, hud } = fixture;
  const enemy = enemies.spawn('grunt', new Vector3(0, 0, -4)),
    health = enemy.hp;
  enemies.clear();
  const blood = vi.spyOn(effects, 'blood'),
    marker = vi.spyOn(hud, 'hitmarker'),
    onKill = vi.spyOn(enemies, 'onKill');
  enemies.damage(enemy, 10000, {
    source: 'rifle',
    part: 'torso',
    point: enemy.center.clone(),
    dir: new Vector3(0, 1, 0),
  });
  expect(enemy.hp).toBe(health);
  expect(enemies.alive).toBe(0);
  expect(blood).not.toHaveBeenCalled();
  expect(marker).not.toHaveBeenCalled();
  expect(onKill).not.toHaveBeenCalled();
});
