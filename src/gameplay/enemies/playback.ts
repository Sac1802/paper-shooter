import type { Object3D, Vector3 } from 'three';
import { clamp } from '../../engine/math.js';
import type { EnemyState } from '../../domain/enemies.js';
export interface PlaybackEnemy {
  t: number;
  alive: boolean;
  state: EnemyState;
  yaw: number;
  readonly aimAmt: number;
  T: { scale: number; weapon: string };
  body: { pos: Vector3 };
  root: Pick<Object3D, 'position' | 'rotation' | 'scale'>;
  hitFeedback: { update(dt: number): void };
  telegraph: { setVisible(visible: boolean): void };
  updateDead(dt: number): void;
  animate(dt: number, target: Vector3): void;
  syncHit(): void;
}
/** Client-only frame coordination. History interpolation is injected; no AI, physics or health authority. */
export class EnemyPlayback<E extends PlaybackEnemy> {
  constructor(
    private readonly population: () => readonly E[],
    private readonly interpolate: (enemy: E, dt: number, now: number) => void,
  ) {}
  update(dt: number, now: number, lookAt: Vector3) {
    for (const enemy of this.population()) {
      enemy.t += dt;
      if (!enemy.alive) {
        enemy.updateDead(dt);
        continue;
      }
      enemy.hitFeedback.update(dt);
      if (enemy.state === 'spawn') this.spawn(enemy);
      this.interpolate(enemy, dt, now);
      enemy.root.position.copy(enemy.body.pos);
      enemy.root.rotation.y = enemy.yaw;
      enemy.animate(dt, lookAt);
      if (enemy.T.weapon === 'sniper') enemy.telegraph.setVisible(enemy.aimAmt > 0.9);
      enemy.syncHit();
    }
  }
  private spawn(enemy: E) {
    const progress = clamp(enemy.t / 0.6, 0, 1);
    enemy.root.scale.setScalar(
      Math.max(
        0.001,
        progress * enemy.T.scale * (1 + Math.sin(enemy.t * 60) * 0.12 * (1 - progress)),
      ),
    );
    if (enemy.t >= 0.6) {
      enemy.state = 'hunt';
      enemy.root.scale.setScalar(enemy.T.scale);
    }
  }
}
