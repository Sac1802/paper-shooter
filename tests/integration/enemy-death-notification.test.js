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
it('suppresses only the mirrored death notification, preserving an observer-triggered independent kill', () => {
  vi.useFakeTimers();
  fixture = applicationFixture();
  fixture.app.session.begin();
  const { enemies } = fixture;
  const boss = enemies.spawn('boss', new Vector3(0, 0, -8)),
    minion = enemies.spawn('grunt', new Vector3(4, 0, -8));
  enemies.mirror = true;
  const killed = vi.fn();
  enemies.onKill = killed;
  enemies.onBoss = (enemy) => {
    if (enemy === boss && !enemy.alive)
      enemies.kill(minion, { source: 'rifle', dir: new Vector3(0, 1, 0) });
  };
  enemies.killMirror(boss.id, { source: 'rifle', dir: [0, 1, 0] });
  expect(killed).toHaveBeenCalledOnce();
  expect(killed.mock.calls[0][0]).toBe(minion);
  expect(enemies.alive).toBe(0);
});
