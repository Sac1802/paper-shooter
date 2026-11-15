// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { TYPES } from '../../src/domain/enemies.js';
import { applicationFixture } from '../support/application.js';
import baseline from '../fixtures/enemy-mirror-baseline.json';
let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});
const number = (value) => +value.toFixed(10);
function capture() {
  const { enemies, game, resources } = fixture;
  return {
    snapshots: enemies.snapshot(),
    alive: enemies.alive,
    score: game.score,
    resources: resources.resourceCount,
    randomCalls: vi.mocked(Math.random).mock.calls.length,
    actors: enemies.enemies.map((enemy) => {
      enemy.root.updateMatrixWorld(true);
      const nodes = [];
      enemy.root.traverse((node) =>
        nodes.push({ matrix: node.matrixWorld.elements.map(number), visible: node.visible }),
      );
      return {
        id: enemy.id,
        state: enemy.state,
        hp: enemy.hp,
        alive: enemy.alive,
        position: enemy.body.pos.toArray().map(number),
        velocity: enemy.body.vel.toArray().map(number),
        ground: enemy.body.onGround,
        yaw: number(enemy.yaw),
        nodes,
      };
    }),
  };
}
it('preserves compact enemy snapshots, mirror interpolation/poses and corpse retirement', () => {
  vi.useFakeTimers();
  fixture = applicationFixture();
  const { app, enemies } = fixture;
  app.session.begin();
  enemies.mirror = true;
  const actors = Object.entries(TYPES).map(([kind, definition], index) => ({
    definition,
    enemy: enemies.spawn(kind, new Vector3(index * 3, 0, -8), index + 1),
  }));
  const frames = [capture()];
  const deliver = (stage, stateCode) =>
    enemies.applySnapshot(
      actors.map(({ enemy, definition }, index) => [
        enemy.id,
        index * 3 + stage * 0.7,
        stage > 1 ? 1 : 0,
        -8 - stage,
        0.2 * stage,
        stateCode,
        definition.hp - stage * 3,
        stage === 1 ? 0.95 : 0.4,
        definition.weapon === 'blade' ? 0.45 : 0,
        definition.weapon === 'bomb' ? 1 : 0,
        definition.boss && stage > 0 ? 1 : 0,
      ]),
      performance.now() / 1000,
    );
  deliver(0, 0);
  for (let i = 1; i <= 22; i++) {
    vi.advanceTimersByTime(50);
    if (i === 5) deliver(1, 1);
    if (i === 11) deliver(2, 2);
    if (i === 17) deliver(3, 1);
    enemies.update(0.05);
    if ([1, 4, 7, 13, 22].includes(i)) frames.push(capture());
  }
  const onKill = vi.spyOn(enemies, 'onKill');
  enemies.killMirror(1, { source: 'blast', dir: [0, 1, 0], point: [0, 1, -8], crit: true });
  frames.push(capture());
  for (let i = 0; i < 210; i++) {
    vi.advanceTimersByTime(50);
    enemies.update(0.05);
  }
  frames.push(capture());
  expect(onKill).not.toHaveBeenCalled();
  expect(enemies.enemies.some((enemy) => enemy.id === 1)).toBe(false);
  const fingerprint = createHash('sha256').update(JSON.stringify(frames)).digest('hex');
  if (process.env.RECORD_ENEMY_MIRROR_BASELINE === '1')
    writeFileSync(
      'tests/fixtures/enemy-mirror-baseline.json',
      JSON.stringify({ fingerprint }, null, 2) + '\n',
    );
  else {
    if (fingerprint !== baseline.fingerprint) {
      mkdirSync('reports', { recursive: true });
      writeFileSync('reports/enemy-mirror-trace.json', JSON.stringify({ fingerprint, frames }));
    }
    expect(fingerprint).toBe(baseline.fingerprint);
  }
});
