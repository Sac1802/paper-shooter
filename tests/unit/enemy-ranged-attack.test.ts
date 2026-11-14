import { expect, it, vi } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { TYPES, type EnemyKind } from '../../src/domain/enemies.js';
import {
  createRangedAttack,
  type EnemyBullet,
  type RangedAttackPorts,
} from '../../src/gameplay/enemies/ranged-attack.js';
function fixture(kind: EnemyKind) {
  const attachment = new Object3D();
  attachment.position.set(0, 1, -1);
  attachment.updateMatrixWorld(true);
  const clock = { remaining: 0 },
    shots: { point: Vector3; direction: Vector3; bullet: EnemyBullet }[] = [];
  const ports: RangedAttackPorts = {
    center: new Vector3(0, 1, -2),
    damageModifier: () => 2,
    laser: { show: vi.fn(), hide: vi.fn() },
    audio: { sniperAim: vi.fn(), sniperShot: vi.fn(), enemyShot: vi.fn(), shotgun: vi.fn() },
    effects: { strokeBurst: vi.fn() },
    emit: vi.fn((point, direction, bullet) =>
      shots.push({ point: point.clone(), direction: direction.clone(), bullet: { ...bullet } }),
    ),
  };
  const attack = createRangedAttack(TYPES[kind], attachment, clock, ports);
  return { attack, clock, ports, shots };
}
it('delays the first burst projectile until the next update, completes exactly once and respects cooldown', () => {
  const { attack, clock, ports, shots } = fixture('grunt');
  if (!attack) throw Error('Missing ranged attack');
  const target = new Vector3(0, 1, 8);
  attack.shoot(0.1, target, 0);
  expect(attack.burstLeft).toBe(3);
  expect(shots).toHaveLength(0);
  for (let i = 0; i < 3; i++) attack.shoot(0.2, target, 0);
  expect(shots).toHaveLength(3);
  expect(attack.burstLeft).toBe(0);
  expect(clock.remaining).toBeGreaterThanOrEqual(1.6);
  expect(clock.remaining).toBeLessThanOrEqual(2.6);
  expect(ports.audio.enemyShot).toHaveBeenCalledTimes(3);
  attack.shoot(0.2, target, 0);
  expect(shots).toHaveLength(3);
});
it('interrupts a pending burst without firing stale shots when sight is lost', () => {
  const { attack, clock, shots, ports } = fixture('shield');
  if (!attack) throw Error('Missing ranged attack');
  const target = new Vector3(0, 1, 8);
  attack.shoot(0.1, target, 0);
  attack.interrupt();
  clock.remaining = 1;
  attack.shoot(1, target, 0);
  expect(attack.burstLeft).toBe(0);
  expect(shots).toHaveLength(0);
  expect(ports.laser.hide).toHaveBeenCalledOnce();
});
it('fires the existing shotgun pellet count with bounded speed, damage scaling and normalized directions', () => {
  const { attack, clock, shots, ports } = fixture('heavy');
  if (!attack) throw Error('Missing ranged attack');
  attack.shoot(0.1, new Vector3(0, 1, 8), 2);
  expect(shots).toHaveLength(7);
  expect(clock.remaining).toBeGreaterThanOrEqual(2.4);
  expect(ports.audio.shotgun).toHaveBeenCalledOnce();
  for (const { direction, bullet } of shots) {
    expect(direction.length()).toBeCloseTo(1);
    expect(bullet.damage).toBe(10);
    expect(bullet.speed).toBeGreaterThanOrEqual(32 * 0.85);
    expect(bullet.speed).toBeLessThanOrEqual(32 * 1.1);
    expect(bullet.thickness).toBe(0.05);
  }
});
it('tracks the sniper telegraph progressively, warns once and resets its aim after a shot', () => {
  const { attack, clock, shots, ports } = fixture('sniper');
  if (!attack) throw Error('Missing ranged attack');
  let beam: Vector3 | undefined;
  vi.mocked(ports.laser.show).mockImplementation((_from, to) => {
    beam = to.clone();
  });
  const target = new Vector3(0, 1, 10);
  attack.shoot(0.85, target, 0);
  expect(ports.audio.sniperAim).not.toHaveBeenCalled();
  target.x = 10;
  attack.shoot(0.01, target, 0);
  expect(beam?.x).toBeGreaterThan(0);
  expect(beam?.x).toBeLessThan(10);
  expect(ports.audio.sniperAim).toHaveBeenCalledOnce();
  expect(shots).toHaveLength(0);
  for (let i = 0; i < 10; i++) attack.shoot(0.1, target, 0);
  expect(shots).toHaveLength(1);
  expect(ports.audio.sniperAim).toHaveBeenCalledOnce();
  expect(ports.audio.sniperShot).toHaveBeenCalledOnce();
  expect(attack.aimT).toBe(0);
  expect(clock.remaining).toBeGreaterThanOrEqual(2.8);
  attack.interrupt();
  expect(attack.aimT).toBe(0);
});
it('uses target speed to widen dispersion without changing projectile speed', () => {
  const slow = fixture('heavy'),
    fast = fixture('heavy');
  if (!slow.attack || !fast.attack) throw Error('Missing ranged attack');
  vi.mocked(Math.random).mockReturnValue(0.9);
  const target = new Vector3(0, 1, 10);
  slow.attack.shoot(0.1, target, 0);
  fast.attack.shoot(0.1, target, 10);
  expect(Math.abs(fast.shots[0].direction.x)).toBeGreaterThan(Math.abs(slow.shots[0].direction.x));
  expect(fast.shots[0].bullet.speed).toBe(slow.shots[0].bullet.speed);
});
it.each(['rusher', 'bomber', 'flyer', 'boss', 'eraser', 'inkblot'] as const)(
  'does not allocate a gun controller for %s',
  (kind) => {
    expect(fixture(kind).attack).toBeNull();
  },
);
