import { expect, it, vi } from 'vitest';
import { DeathProgress } from '../../src/application/death-progress.js';
import type { DeathState } from '../../src/application/death-progress.js';

function fixture() {
  const state: DeathState = {
    mode: 'ffa',
    menu: false,
    deathT: 0,
    respawnT: 2.5,
    respawnArm: 0,
    promptT: 0,
  };
  const input = { lastActive: 10, pressed: vi.fn(() => false), down: vi.fn(() => false) };
  const hud = { message: vi.fn(), key: vi.fn(() => 'ENTER') };
  const respawn = vi.fn(),
    soloReady = vi.fn();
  const progress = new DeathProgress({ state, input, hud, respawn, soloReady });
  return { progress, state, input, hud, respawn, soloReady };
}
it('ignores other phases and preserves the strictly-after-1.7-second solo delay', () => {
  const { progress, state, soloReady, hud } = fixture();
  state.mode = 'solo';
  progress.update('play', 2);
  expect(state.deathT).toBe(0);
  progress.update('dying', 1.7);
  expect(soloReady).not.toHaveBeenCalled();
  progress.update('dying', 0.001);
  expect(soloReady).toHaveBeenCalledOnce();
  expect(hud.message).not.toHaveBeenCalled();
});
it('announces countdown changes and arms against input at the zero crossing', () => {
  const { progress, input, state, hud, respawn } = fixture();
  progress.update('dying', 0.05);
  expect(hud.message).toHaveBeenLastCalledWith('3', 'back on the page in', 1.1);
  progress.update('dying', 0.05);
  expect(hud.message).toHaveBeenCalledOnce();
  progress.update('dying', 0.9);
  expect(hud.message).toHaveBeenLastCalledWith('2', 'back on the page in', 1.1);
  input.lastActive++;
  progress.update('dying', 1.6);
  expect(state.respawnArm).toBe(input.lastActive);
  expect(state.promptT).toBe(0);
  expect(respawn).not.toHaveBeenCalled();
  progress.update('dying', 0.01);
  expect(hud.message).toHaveBeenLastCalledWith(
    'READY',
    'press ENTER · any button or click to respawn',
    1.5,
  );
  expect(respawn).not.toHaveBeenCalled();
  input.lastActive++;
  progress.update('dying', 0.01);
  expect(respawn).toHaveBeenCalledOnce();
});
it('keeps countdown running under the menu but waits to show readiness or accept input', () => {
  const { progress, state, input, hud, respawn } = fixture();
  state.menu = true;
  progress.update('dying', 3);
  input.lastActive++;
  progress.update('dying', 0.1);
  expect(state.respawnT).toBeLessThan(0);
  expect(hud.message).not.toHaveBeenCalled();
  expect(respawn).not.toHaveBeenCalled();
  state.menu = false;
  progress.update('dying', 0.1);
  expect(respawn).toHaveBeenCalledOnce();
});
it('blocks pause edges and held pause even when input activity changes', () => {
  const { progress, state, input, respawn } = fixture();
  state.respawnT = 0;
  input.pressed.mockReturnValue(true);
  progress.update('dying', 0.01);
  expect(respawn).not.toHaveBeenCalled();
  input.pressed.mockReturnValue(false);
  input.down.mockReturnValue(true);
  progress.update('dying', 0.01);
  expect(respawn).not.toHaveBeenCalled();
  input.down.mockReturnValue(false);
  progress.update('dying', 0.01);
  expect(respawn).toHaveBeenCalledOnce();
});
it('throttles the ready prompt independently from the countdown', () => {
  const { progress, state, input, hud } = fixture();
  state.respawnT = 0;
  state.respawnArm = input.lastActive;
  progress.update('dying', 0.01);
  progress.update('dying', 1);
  expect(hud.message).toHaveBeenCalledOnce();
  progress.update('dying', 0.5);
  expect(hud.message).toHaveBeenCalledTimes(2);
});
