import { Vector3 } from 'three';
import type { SceneResourcePort } from '../../engine/ports.js';
import { enemyDeathDecision } from '../../domain/enemy-death.js';
import type { EnemyImpact } from '../../domain/enemy-impact.js';
import type { EnemyActor } from './actor.js';
import type { EnemyPopulation } from './population.js';
import type { EnemyAreaDamage } from './area-damage.js';
import type { EnemyDeathFeedbackPort } from '../../presentation/characters/death-feedback.js';
export interface EnemyLifecyclePorts {
  resources: SceneResourcePort;
  score(points: number, label: string): void;
  killed(actor: EnemyActor, impact: EnemyImpact, severed: boolean): void;
  bossChanged(actor: EnemyActor): void;
}
export interface MirroredEnemyDeath {
  source: string;
  crit?: boolean;
  part?: string;
  dir?: number[] | null;
  point?: number[] | null;
}
/** Owns ordered death/retirement policy. Notification suppression is local to one death operation. */
export class EnemyLifecycle {
  private readonly up = new Vector3(0, 1, 0);
  private readonly fallbackDirection = new Vector3();
  constructor(
    private readonly population: EnemyPopulation<EnemyActor>,
    private readonly area: EnemyAreaDamage<EnemyActor>,
    private readonly feedback: EnemyDeathFeedbackPort,
    private readonly ports: EnemyLifecyclePorts,
  ) {}
  kill(enemy: EnemyActor, impact: EnemyImpact, notify = true) {
    if (!this.population.markDead(enemy)) return;
    enemy.body.vel.set(0, 0, 0);
    this.feedback.begin(enemy.face, enemy.telegraph);
    const direction = (impact.dir || this.fallbackDirection.set(0, 0.5, 0)).clone().normalize();
    if (enemy.T.weapon === 'bomb') {
      this.explode(enemy, 0.8);
      if (notify) this.ports.killed(enemy, impact, true);
      return;
    }
    this.feedback.die(enemy.center);
    if (enemy.T.flying) {
      this.feedback.flyer(enemy.root, enemy.center, direction, () => {
        enemy.rootDetached = true;
      });
      if (notify) this.ports.killed(enemy, impact, true);
      return;
    }
    const decision = enemyDeathDecision(enemy.hp, enemy.maxHp, impact);
    enemy.disassembly?.perform(impact, direction, decision);
    if (enemy.T.boss) {
      this.feedback.boss(enemy.center);
      this.ports.bossChanged(enemy);
    }
    if (notify) this.ports.killed(enemy, impact, decision.sever);
  }
  explode(enemy: EnemyActor, scale = 1) {
    if (enemy.T.weapon !== 'bomb') return;
    this.area.bomber(enemy.center, enemy.T, enemy, scale);
    if (enemy.alive) {
      this.population.markDead(enemy);
      this.ports.killed(enemy, { source: 'blast', dir: this.up.clone() }, true);
    }
    this.ports.resources.release(enemy.root);
    enemy.rootDetached = true;
    enemy.deadT = 99;
  }
  shieldBroken() {
    this.ports.score(40, 'SHIELD BROKEN');
  }
  killMirror(id: number, impact: MirroredEnemyDeath) {
    const enemy = this.population.byId.get(id);
    if (!enemy?.alive) return;
    this.kill(
      enemy,
      {
        ...impact,
        dir: impact.dir ? new Vector3().fromArray(impact.dir) : this.up.clone(),
        point: impact.point ? new Vector3().fromArray(impact.point) : enemy.center.clone(),
      },
      false,
    );
  }
}
