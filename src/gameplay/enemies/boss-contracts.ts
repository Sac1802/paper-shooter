import type { Vector3 } from 'three';
import type { BossFeedbackPort } from '../../presentation/characters/boss-feedback.js';
import type { PerceivedTarget } from './perception.js';
export interface BossTarget {
  alive: boolean;
  body: { pos: Vector3 };
  center: Vector3;
  takeDamage(amount: number, from: Vector3): void;
  knockback(direction: Vector3, amount: number): void;
}
export interface BossBullet {
  speed: number;
  damage: number;
  ink: number;
  thickness: number;
  blast: 1;
}
export interface BossTargets {
  targets: () => readonly BossTarget[];
  damageModifier: () => number;
  center: Vector3;
}
export interface BossSpawnPort {
  count(kind: 'bomber' | 'flyer'): number;
  spawnReady(kind: 'bomber' | 'flyer', position: Vector3): void;
}
export interface DoodlerActions extends BossTargets {
  head(out: Vector3): Vector3;
  emit(position: Vector3, direction: Vector3, shot: BossBullet): void;
  blast(position: Vector3, radius: number, damage: number): void;
  feedback: Pick<BossFeedbackPort, 'roar' | 'shot' | 'doodlerStomp'>;
}
export interface EraserActions extends BossTargets, BossSpawnPort {
  speedModifier: () => number;
  feedback: Pick<BossFeedbackPort, 'roar' | 'shake' | 'eraserRub' | 'eraserWall' | 'eraserTrail'>;
}
export interface InkblotActions extends BossTargets, BossSpawnPort {
  torso(out: Vector3): Vector3;
  emit(position: Vector3, direction: Vector3, shot: BossBullet): void;
  feedback: Pick<BossFeedbackPort, 'shot' | 'inkblotSummon' | 'inkblotLand'>;
}
export interface BossBehavior {
  readonly attackPose: Readonly<{ kind: string; t: number }> | null;
  readonly aimAmt: number;
  update(dt: number, target: Readonly<PerceivedTarget>): void;
  idle(dt: number): void;
  applyAim(amount: number): void;
  applyAttack(active: boolean): void;
}
