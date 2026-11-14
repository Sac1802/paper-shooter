import type { Vector3 } from 'three';
export interface DirectedEnemyMotion {
  heading: number;
  steer(gx: number, gz: number, speed: number, acceleration: number, dt: number): number | null;
  follow(dt: number, target: Vector3, speed: number): number | null;
}

export interface EnemyAttackClock {
  remaining: number;
}

export interface MeleeTarget {
  tryBlockMelee(source: { center: Vector3 }): boolean;
  takeDamage(amount: number, from: Vector3): void;
}
