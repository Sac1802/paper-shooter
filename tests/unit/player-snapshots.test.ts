import { expect, it } from 'vitest';
import { encodeLocal, type LocalSnapshotSource } from '../../src/domain/player-snapshots.js';
function source(): LocalSnapshotSource {
  return {
    body: {
      pos: { x: 1.234, y: -2.346, z: 3.456 },
      vel: { x: 1.234, y: -2.346, z: 3.456 },
      onGround: false,
    },
    yaw: 1.234,
    pitch: -0.456,
    crouching: false,
    sliding: false,
    isBlocking: false,
    _aiming: false,
    alive: false,
    parryWindow: false,
    hp: 88.4,
  };
}
it('projects precision and fixed wire positions without changing its source', () => {
  const player = source();
  const before = structuredClone(player);
  expect(encodeLocal(player, 2)).toEqual([
    1.23, -2.35, 3.46, 1.23, -0.46, 2, 0, 88, 1.2, -2.3, 3.5,
  ]);
  expect(player).toEqual(before);
});
it('preserves all existing flags and appends only an active grapple hook', () => {
  const player = source();
  Object.assign(player, {
    crouching: true,
    sliding: true,
    isBlocking: true,
    _aiming: true,
    alive: true,
    parryWindow: true,
  });
  player.body.onGround = true;
  player.grapple = { state: 'on', hook: { x: 4.234, y: 5.456, z: -6.789 } };
  const packet = encodeLocal(player, 3, { firing: true, idle: true, untouched: true, away: true });
  expect(packet[6]).toBe(4095);
  expect(packet).toHaveLength(14);
  expect(packet.slice(11)).toEqual([4.2, 5.5, -6.8]);
  player.grapple.state = 'idle';
  expect(encodeLocal(player, 3)).toHaveLength(11);
  expect(encodeLocal(player, 3)[6] & 128).toBe(0);
});
