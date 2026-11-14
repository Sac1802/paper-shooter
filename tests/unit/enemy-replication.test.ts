import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import type { EnemyState } from '../../src/domain/enemies.js';
import type { EnemySnapshot } from '../../src/domain/enemy-snapshots.js';
import { EnemyReplication, type ReplicaEnemy } from '../../src/gameplay/enemies/replication.js';
class Actor implements ReplicaEnemy {
  alive = true;
  state: EnemyState = 'hunt';
  hp = 100;
  yaw = 0;
  body = { pos: new Vector3(), vel: new Vector3(), onGround: true };
  aimAmt = 0;
  attackTime = 0;
  fuseTime = -1;
  bossAttacking = false;
  isBoss = false;
  constructor(readonly id: number) {}
  applyReplicaState(state: EnemyState, hp: number) {
    this.state = state;
    this.hp = hp;
  }
  applyReplicaCombat(aim: number, attack: number, fuse: boolean, boss: boolean) {
    this.aimAmt = aim;
    this.attackTime = attack;
    this.fuseTime = fuse ? 0.5 : -1;
    this.bossAttacking = boss;
  }
}
function fixture() {
  const actors = [new Actor(1), new Actor(2)],
    index = new Map(actors.map((actor) => [actor.id, actor])),
    boss = vi.fn(),
    sync = new EnemyReplication(
      () => actors,
      () => index,
      boss,
    );
  return { actors, index, boss, sync };
}
it('keeps the compact tuple layout and rounding while omitting dead actors', () => {
  const { actors, sync } = fixture(),
    actor = actors[0];
  actor.body.pos.set(1.234, 2.346, 3.456);
  actor.yaw = 0.256;
  actor.state = 'stunned';
  actor.hp = 123.7;
  actor.aimAmt = 0.456;
  actor.attackTime = 0.123;
  actor.fuseTime = 0;
  actor.bossAttacking = true;
  actors[1].alive = false;
  expect(sync.snapshot()).toEqual([[1, 1.23, 2.35, 3.46, 0.26, 2, 124, 0.46, 0.12, 1, 1]]);
});
it('applies snapshot state/pose before boss notification and skips missing/dead IDs', () => {
  const { actors, boss, sync } = fixture(),
    actor = actors[0];
  actor.isBoss = true;
  actors[1].alive = false;
  boss.mockImplementation(() => {
    expect(actor.hp).toBe(90);
    expect(actor.aimAmt).toBe(0.7);
    expect(actor.bossAttacking).toBe(true);
  });
  const row: EnemySnapshot = [1, 10, 0, 0, Math.PI / 2, 1, 90, 0.7, 0.3, 1, 1];
  const dead: EnemySnapshot = [...row],
    missing: EnemySnapshot = [...row];
  dead[0] = 2;
  missing[0] = 404;
  sync.apply([row, dead, missing], 0);
  expect(boss).toHaveBeenCalledExactlyOnceWith(actor);
  expect(actor.attackTime).toBe(0.3);
  expect(actor.fuseTime).toBe(0.5);
  expect(actors[1].hp).toBe(100);
});
it('renders behind the newest sample, bounds extrapolation and clamps inferred velocity', () => {
  const { actors, sync } = fixture(),
    actor = actors[0];
  sync.apply([[1, 10, 0, 0, Math.PI / 2, 1, 100, 0, 0, 0, 0]], 0);
  sync.interpolate(actor, 0.05, 0);
  expect(actor.body.pos.x).toBe(0);
  sync.interpolate(actor, 0.05, 0.1);
  expect(actor.body.pos.x).toBe(10);
  expect(actor.body.vel.length()).toBe(30);
  expect(actor.yaw).toBeCloseTo(Math.PI / 2);
  sync.interpolate(actor, 0.05, 1);
  expect(actor.body.pos.x).toBe(12);
  expect(actor.yaw).toBeCloseTo(Math.PI * 0.6);
  expect(actor.body.onGround).toBe(true);
});
it('handles coincident timestamps, zero dt and clearing history without nonfinite motion', () => {
  const { actors, sync } = fixture(),
    actor = actors[0];
  sync.apply([[1, 0, 0, 0, 0, 1, 100, 0, 0, 0, 0]], 0);
  sync.apply([[1, 10, 0, 0, 0, 1, 100, 0, 0, 0, 0]], 0);
  sync.interpolate(actor, 0, 0.11);
  expect(actor.body.pos.x).toBeCloseTo(5);
  expect(actor.body.vel.toArray().every(Number.isFinite)).toBe(true);
  sync.clear();
  actor.body.pos.set(3, 0, 0);
  sync.interpolate(actor, 0.05, 1);
  expect(actor.body.pos.x).toBe(3);
});
it('does not move a dead actor from cached live samples', () => {
  const { actors, sync } = fixture(),
    actor = actors[0];
  sync.apply([[1, 10, 0, 0, 0, 1, 100, 0, 0, 0, 0]], 0);
  actor.alive = false;
  sync.interpolate(actor, 0.05, 1);
  expect(actor.body.pos.x).toBe(0);
});
