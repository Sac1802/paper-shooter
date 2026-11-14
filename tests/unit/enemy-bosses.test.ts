import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { TYPES } from '../../src/domain/enemies.js';
import { makeBody } from '../../src/engine/physics.js';
import { createBossBehavior } from '../../src/gameplay/enemies/boss-factory.js';
import type { BossServices } from '../../src/gameplay/enemies/boss-factory.js';
import type { BossBullet } from '../../src/gameplay/enemies/boss-contracts.js';
import type { PerceivedTarget } from '../../src/gameplay/enemies/perception.js';
function fixture(kind: 'boss' | 'eraser' | 'inkblot') {
  const body = makeBody(new Vector3(), 0.8, 4),
    clock = { remaining: 0 },
    motion = { heading: 0, steer: vi.fn(() => 0), follow: vi.fn(() => 0) };
  body.onGround = true;
  const victim = {
    alive: true,
    body: { pos: new Vector3(0, 0, 2) },
    center: new Vector3(0, 1, 2),
    takeDamage: vi.fn(),
    knockback: vi.fn(),
  };
  const shots: { position: Vector3; direction: Vector3; shot: BossBullet }[] = [];
  const feedback = {
    roar: vi.fn(),
    shot: vi.fn(),
    shake: vi.fn(),
    doodlerStomp: vi.fn(),
    eraserRub: vi.fn(),
    eraserWall: vi.fn(),
    eraserTrail: vi.fn(),
    inkblotSummon: vi.fn(),
    inkblotLand: vi.fn(),
  };
  const services: BossServices = {
    center: new Vector3(0, 2, 0),
    targets: () => [victim],
    damageModifier: () => 2,
    speedModifier: () => 1,
    feedback,
    head: (out) => out.set(0, 4, 0),
    torso: (out) => out.set(0, 2, 0),
    emit: vi.fn((position, direction, shot) =>
      shots.push({ position: position.clone(), direction: direction.clone(), shot: { ...shot } }),
    ),
    blast: vi.fn(),
    count: vi.fn(() => 0),
    spawnReady: vi.fn(),
  };
  const boss = createBossBehavior(TYPES[kind], { body, clock, motion }, services);
  if (!boss) throw Error('Missing boss');
  const target: PerceivedTarget = {
    position: new Vector3(0, 0, 10),
    center: new Vector3(0, 1, 10),
    dx: 0,
    dz: 10,
    distance: 10,
    height: 0,
    yaw: 0.4,
    visible: true,
  };
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      clock.remaining -= 0.05;
      boss.update(0.05, target);
    }
  };
  return { body, clock, motion, victim, shots, feedback, services, boss, target, tick };
}
it('telegraphs one Doodler stomp, applies its area damage once and starts cooldown', () => {
  const { boss, target, clock, feedback, services, victim, tick } = fixture('boss');
  target.distance = 4;
  tick();
  expect(boss.attackPose?.kind).toBe('stomp');
  expect(feedback.roar).toHaveBeenCalledOnce();
  expect(victim.takeDamage).not.toHaveBeenCalled();
  tick(35);
  expect(feedback.doodlerStomp).toHaveBeenCalledOnce();
  expect(victim.takeDamage).toHaveBeenCalledWith(44, services.center);
  expect(victim.takeDamage).toHaveBeenCalledOnce();
  expect(services.blast).toHaveBeenCalledWith(expect.any(Vector3), 6, 60);
  expect(boss.attackPose).toBeNull();
  expect(clock.remaining).toBeGreaterThan(0);
});
it('throws one arced Doodler projectile with the original damage and speed', () => {
  const { boss, target, shots, feedback, tick } = fixture('boss');
  target.distance = 20;
  tick(30);
  expect(shots).toHaveLength(1);
  expect(shots[0].shot).toMatchObject({ speed: 24, damage: 22 * 0.9, thickness: 0.4, blast: 1 });
  expect(shots[0].direction.length()).toBeCloseTo(1);
  expect(feedback.shot).toHaveBeenCalledOnce();
  expect(boss.attackPose).toBeNull();
});
it('locks the Eraser charge direction during windup and hits a player only once before wall recovery', () => {
  const { boss, target, body, victim, feedback, tick } = fixture('eraser');
  tick(14);
  expect(feedback.roar).toHaveBeenCalledOnce();
  target.position.set(10, 0, 0);
  victim.body.pos.set(1, 0, 0);
  tick(5);
  expect(body.vel.x).toBe(0);
  expect(body.vel.z).toBe(17);
  expect(victim.takeDamage).toHaveBeenCalledOnce();
  expect(victim.takeDamage).toHaveBeenCalledWith(52, expect.any(Vector3));
  body.hitWall = true;
  tick();
  expect(feedback.eraserWall).toHaveBeenCalledOnce();
  tick(20);
  expect(boss.attackPose).toBeNull();
  expect(victim.takeDamage).toHaveBeenCalledOnce();
});
it('caps Eraser scrub summons and retains the approximate active-attack snapshot transition', () => {
  const { boss, services, feedback, tick } = fixture('eraser');
  vi.mocked(services.count).mockReturnValue(3);
  boss.applyAttack(true);
  expect(boss.attackPose?.t).toBe(0.3);
  tick(25);
  expect(feedback.eraserRub).toHaveBeenCalledOnce();
  expect(services.spawnReady).toHaveBeenCalledTimes(1);
  expect(services.spawnReady).toHaveBeenCalledWith('bomber', expect.any(Vector3));
  boss.applyAttack(false);
  expect(boss.attackPose).toBeNull();
});
it('emits exactly nine Inkblot fan shots and one initial firing cue', () => {
  const { shots, feedback, target, tick } = fixture('inkblot');
  target.distance = 20;
  tick(50);
  expect(shots).toHaveLength(9);
  expect(feedback.shot).toHaveBeenCalledOnce();
  for (const { direction, shot } of shots) {
    expect(direction.length()).toBeCloseTo(1);
    expect(shot).toMatchObject({ speed: 20, damage: 22, thickness: 0.3, blast: 1 });
  }
});
it('caps Inkblot summons and applies a landing burst once after a grounded hop', () => {
  const { boss, body, clock, services, feedback, victim, tick } = fixture('inkblot');
  vi.mocked(services.count).mockReturnValue(5);
  boss.applyAttack(true);
  tick(25);
  expect(feedback.inkblotSummon).toHaveBeenCalledOnce();
  expect(services.spawnReady).toHaveBeenCalledTimes(1);
  boss.applyAttack(false);
  clock.remaining = 100;
  tick(25);
  expect(body.onGround).toBe(false);
  expect(body.vel.y).toBe(13);
  body.onGround = true;
  tick();
  expect(feedback.inkblotLand).toHaveBeenCalledOnce();
  expect(victim.takeDamage).toHaveBeenCalledWith(28, services.center);
  tick();
  expect(feedback.inkblotLand).toHaveBeenCalledOnce();
});
it.each(['boss', 'eraser', 'inkblot'] as const)(
  'idles %s with owned aim and does not execute attacks while accepting snapshot state',
  (kind) => {
    const { boss, body, services, target } = fixture(kind);
    boss.applyAim(0.8);
    body.vel.set(5, 0, 5);
    boss.idle(0.1);
    expect(boss.aimAmt).toBeLessThan(0.8);
    expect(body.vel.x).toBeLessThan(5);
    boss.applyAttack(true);
    const phase = boss.attackPose;
    boss.applyAttack(true);
    expect(boss.attackPose).toBe(phase);
    expect(services.emit).not.toHaveBeenCalled();
    target.visible = false;
  },
);
