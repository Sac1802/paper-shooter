import type { EnemyDefinition } from '../../domain/enemy-definitions.js';
import type { EnemyImpact } from '../../domain/enemy-impact.js';
import type { EnemyHitFeedbackPort } from '../../presentation/characters/hit-feedback.js';
export interface EnemyCombatPorts {
  present: () => boolean;
  mirror: () => boolean;
  damageModifier: () => number;
  feedback: EnemyHitFeedbackPort;
  clientHit(amount: number, impact: EnemyImpact): void;
  breakShield(): void;
  wake(): void;
  bossChanged(): void;
  hitstop(duration: number, scale: number): void;
  kill(impact: EnemyImpact): void;
}
/** Owns health/shield and authority decisions; population membership owns the death transition/count. */
export class EnemyCombat {
  hp: number;
  maxHp: number;
  alive = true;
  shieldHp: number;
  constructor(
    private readonly definition: Pick<EnemyDefinition, 'hp' | 'shield' | 'boss'>,
    private readonly ports: EnemyCombatPorts,
  ) {
    this.hp = this.maxHp = definition.hp;
    this.shieldHp = definition.shield ? 2 : 0;
  }
  damage(amount: number, impact: EnemyImpact) {
    if (!this.alive || !this.ports.present()) return;
    if (this.ports.mirror()) {
      this.mirroredHit(amount, impact);
      return;
    }
    if (impact.part === 'shield') {
      this.shieldHit(impact);
      return;
    }
    amount *= this.ports.damageModifier();
    this.hp -= amount;
    this.ports.feedback.hit(amount, impact, { mirror: false, lethal: this.hp <= 0 });
    this.ports.wake();
    if (this.definition.boss) this.ports.bossChanged();
    if (this.hp <= 0) {
      this.ports.hitstop(impact.crit ? 0.05 : 0.025, 0.25);
      this.ports.kill(impact);
    }
  }
  private mirroredHit(amount: number, impact: EnemyImpact) {
    if (impact.part !== 'shield')
      this.ports.feedback.hit(amount, impact, { mirror: true, lethal: false });
    this.ports.clientHit(amount, impact);
  }
  private shieldHit(impact: EnemyImpact) {
    this.ports.feedback.shield(impact);
    if (impact.source === 'katana' || impact.source === 'blast') {
      this.shieldHp--;
      if (this.shieldHp <= 0) this.ports.breakShield();
    }
    this.ports.feedback.shieldMarker();
  }
}
