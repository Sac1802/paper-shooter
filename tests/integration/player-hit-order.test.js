// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';
let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
});
it('keeps the nearer player hit when a later player guards farther along the ray', () => {
  fixture = applicationFixture();
  const { app, ctx, game, remote } = fixture;
  game.mode = 'ffa';
  const near = app.multiplayer.addRemote('near', 'near');
  const far = app.multiplayer.addRemote('far', 'far');
  near.push([0, 0, -3, Math.PI, 0, 0, 64 | 16, 100, 0, 0, 0], 0);
  far.push([0, 0, -8, Math.PI, 0, 3, 64 | 16 | 4, 100, 0, 0, 0], 0);
  near.update(0.02, 0);
  far.update(0.02, 0);
  const origin = new Vector3(0, 1.25, 0),
    direction = new Vector3(0, 0, -1);
  expect(ctx.raycastPlayers(origin, direction, 30)?.player.id).toBe('near');
  // Join order must not change which physical target is first along the ray.
  remote.delete('near');
  remote.set('near', near);
  expect(ctx.raycastPlayers(origin, direction, 30)?.player.id).toBe('near');
});
