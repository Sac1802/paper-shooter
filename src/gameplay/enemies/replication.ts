import { Vector3 } from 'three';
import { STATE_CODES, STATE_NAMES, type EnemyState } from '../../domain/enemies.js';
import type { EnemySnapshot } from '../../domain/enemy-snapshots.js';
import { clamp, angleLerp } from '../../engine/math.js';
export interface ReplicaEnemy {
  id: number;
  alive: boolean;
  state: EnemyState;
  hp: number;
  yaw: number;
  body: { pos: Vector3; vel: Vector3; onGround: boolean };
  readonly aimAmt: number;
  readonly attackTime: number;
  readonly fuseTime: number;
  readonly bossAttacking: boolean;
  readonly isBoss: boolean;
  applyReplicaState(state: EnemyState, hp: number): void;
  applyReplicaCombat(aim: number, attack: number, fuse: boolean, boss: boolean): void;
}
interface SnapshotPose {
  p: Vector3;
  yaw: number;
  t: number;
}
interface Frames {
  previous: SnapshotPose;
  next: SnapshotPose;
}
/** Owns replica history/interpolation; wire projection uses an actor protocol with no brain/model dependencies. */
export class EnemyReplication<E extends ReplicaEnemy> {
  private frames = new WeakMap<E, Frames>();
  private readonly position = new Vector3();
  constructor(
    private readonly population: () => readonly E[],
    private readonly index: () => ReadonlyMap<number, E>,
    private readonly bossChanged: (enemy: E) => void,
  ) {}
  clear() {
    this.frames = new WeakMap();
  }
  snapshot(): EnemySnapshot[] {
    const rows: EnemySnapshot[] = [];
    for (const enemy of this.population()) {
      if (!enemy.alive) continue;
      const position = enemy.body.pos;
      rows.push([
        enemy.id,
        +position.x.toFixed(2),
        +position.y.toFixed(2),
        +position.z.toFixed(2),
        +enemy.yaw.toFixed(2),
        STATE_CODES[enemy.state] ?? 1,
        Math.round(enemy.hp),
        +enemy.aimAmt.toFixed(2),
        +enemy.attackTime.toFixed(2),
        enemy.fuseTime >= 0 ? 1 : 0,
        enemy.bossAttacking ? 1 : 0,
      ]);
    }
    return rows;
  }
  apply(rows: readonly EnemySnapshot[], now: number) {
    for (const row of rows) {
      const enemy = this.index().get(row[0]);
      if (!enemy?.alive) continue;
      const previous = this.frames.get(enemy)?.next ?? {
        p: enemy.body.pos.clone(),
        yaw: enemy.yaw,
        t: now - 0.08,
      };
      this.frames.set(enemy, {
        previous,
        next: { p: new Vector3(row[1], row[2], row[3]), yaw: row[4], t: now },
      });
      enemy.applyReplicaState(STATE_NAMES[row[5]] || 'hunt', row[6]);
      enemy.applyReplicaCombat(row[7], row[8], Boolean(row[9]), Boolean(row[10]));
      if (enemy.isBoss) this.bossChanged(enemy);
    }
  }
  interpolate(enemy: E, dt: number, now: number) {
    if (!enemy.alive) return;
    const frames = this.frames.get(enemy);
    if (!frames) return;
    const span = Math.max(0.02, frames.next.t - frames.previous.t),
      fraction = clamp((now - 0.1 - frames.previous.t) / span, 0, 1.2);
    this.position.lerpVectors(frames.previous.p, frames.next.p, fraction);
    enemy.body.vel
      .subVectors(this.position, enemy.body.pos)
      .divideScalar(Math.max(dt, 1e-3))
      .clampLength(0, 30);
    enemy.body.pos.copy(this.position);
    enemy.body.onGround = Math.abs(enemy.body.vel.y) < 0.5;
    enemy.yaw = angleLerp(frames.previous.yaw, frames.next.yaw, fraction);
  }
}
