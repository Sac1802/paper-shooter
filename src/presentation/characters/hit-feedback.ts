import { Vector3, type ShaderMaterial } from 'three';
import { clamp, damp } from '../../engine/math.js';
import { INK } from '../../shared/ink.js';
import type { EnemyImpact } from '../../domain/enemy-impact.js';
import { setFill } from '../ink/materials.js';
export interface EnemyHitFeedbackPort {
  hit(amount: number, impact: EnemyImpact, outcome: { mirror: boolean; lethal: boolean }): void;
  shield(impact: EnemyImpact): void;
  shieldMarker(): void;
}
export interface EnemyHitEffects {
  blood(point: Vector3, direction: Vector3, amount: number, options: { ink: number }): void;
  sparks(point: Vector3, direction: Vector3, ink: number, count: number, speed: number): void;
}
export interface EnemyHitPorts {
  effects: EnemyHitEffects;
  audio: {
    headshot(center: Vector3): void;
    hitEnemy(center: Vector3): void;
    shieldHit(point: Vector3): void;
  };
  hud: { hitmarker(killed: boolean, critical?: boolean): void };
  input: { rumble(strong: number, weak: number, duration: number): void };
}
/** Owns hit flash/flinch and feedback recipes; receives outcomes, never health or authority ownership. */
export class EnemyHitFeedback implements EnemyHitFeedbackPort {
  private flinchAmount = 0;
  private flashTime = 0;
  private filled = false;
  private readonly up = new Vector3(0, 1, 0);
  constructor(
    private readonly material: ShaderMaterial,
    private readonly pose: { center: Vector3; ink?: number; boss?: boolean },
    private readonly ports: EnemyHitPorts,
  ) {}
  get amount() {
    return this.flinchAmount;
  }
  nudge() {
    this.flinchAmount = 1;
  }
  flash(duration: number) {
    this.flashTime = duration;
    if (!this.filled) {
      setFill(this.material, true);
      this.filled = true;
    }
  }
  update(dt: number) {
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0 && this.filled) {
        setFill(this.material, false);
        this.filled = false;
      }
    }
    this.flinchAmount = damp(this.flinchAmount, 0, 9, dt);
  }
  hit(amount: number, impact: EnemyImpact, outcome: { mirror: boolean; lethal: boolean }) {
    this.nudge();
    this.flash(0.07);
    const blood =
      clamp(0.5 + amount / 70, 0.5, 2.2) * (outcome.mirror ? 1 : this.pose.boss ? 1.6 : 1);
    this.ports.effects.blood(impact.point || this.pose.center, impact.dir || this.up, blood, {
      ink: this.pose.ink === INK.BLACK ? INK.BLACK : INK.RED,
    });
    if (outcome.mirror) {
      this.ports.hud.hitmarker(false, impact.crit);
      return;
    }
    if (impact.crit) this.ports.audio.headshot(this.pose.center);
    else this.ports.audio.hitEnemy(this.pose.center);
    this.ports.hud.hitmarker(outcome.lethal, impact.crit);
    if (impact.source !== 'deflect') this.ports.input.rumble(0.1, 0.3, 30);
  }
  shield(impact: EnemyImpact) {
    const point = impact.point || this.pose.center;
    this.ports.effects.sparks(
      point,
      impact.dir ? impact.dir.clone().negate() : this.up,
      INK.ORANGE,
      8,
      8,
    );
    this.ports.audio.shieldHit(point);
  }
  shieldMarker() {
    this.ports.hud.hitmarker(false, false);
  }
}
