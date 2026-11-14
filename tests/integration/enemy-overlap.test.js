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
it.each(['lunge', 'standoff', 'parry'])(
  'keeps melee %s finite when player and enemy positions coincide',
  (phase) => {
    vi.useFakeTimers();
    fixture = applicationFixture();
    const { app, world, enemies, player, game } = fixture;
    app.controls.begin();
    game.queue = [];
    game.intermission = 100000;
    world.clear();
    world.addBox({ x: -10, y: -1, z: -10 }, { x: 10, y: 0, z: 10 });
    world.finalize();
    player.body.pos.set(0, 0, 0);
    player.body.vel.set(0, 0, 0);
    player.center.set(0, 1, 0);
    const enemy = enemies.spawn('rusher', new Vector3());
    enemy.state = 'hunt';
    enemy.clock.remaining = phase === 'standoff' ? 1 : 0;
    if (phase === 'parry') vi.spyOn(player, 'tryBlockMelee').mockReturnValue(true);
    vi.spyOn(world, 'hasLineOfSight').mockReturnValue(true);
    enemies.update(0.05);
    if (phase === 'parry') for (let i = 0; i < 8; i++) enemies.update(0.05);
    expect(enemy.body.vel.toArray().every(Number.isFinite)).toBe(true);
    expect(enemy.body.pos.toArray().every(Number.isFinite)).toBe(true);
  },
);
