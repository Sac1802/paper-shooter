import { Vector3 } from 'three';
import { INK } from '../../shared/ink.js';
import type { EnemyImpact } from '../../domain/enemy-impact.js';
import type { BomberEnemyDefinition } from '../../domain/enemy-definitions.js';
export interface BlastEnemy {
  alive: boolean;
  center: Vector3;
}
export interface BlastTarget extends BlastEnemy {
  takeDamage(amount: number, from: Vector3): void;
  knockback(direction: Vector3, amount: number): void;
}
export interface EnemyAreaPorts<E> {
  damage(enemy: E, amount: number, impact: EnemyImpact): void;
  damageModifier: () => number;
  feedback: { explosion(point: Vector3, radius: number, ink: number): void };
}
/** Area combat policy with explicit target readers and impact commands, independent of manager/render context. */
export class EnemyAreaDamage<E extends BlastEnemy> {
  private readonly direction = new Vector3();
  constructor(
    private readonly enemies: () => readonly E[],
    private readonly targets: () => readonly BlastTarget[],
    private readonly ports: EnemyAreaPorts<E>,
  ) {}
  blast(point: Vector3, radius: number, damage: number, except: E | null) {
    for (const enemy of this.enemies()) {
      if (!enemy.alive || enemy === except) continue;
      const distance = enemy.center.distanceTo(point);
      if (distance > radius) continue;
      this.direction.subVectors(enemy.center, point).normalize();
      this.ports.damage(enemy, damage * (1 - (distance / radius) * 0.6), {
        point: enemy.center.clone(),
        dir: this.direction.clone(),
        part: 'torso',
        source: 'blast',
        crit: false,
      });
    }
  }
  bomber(origin: Vector3, definition: BomberEnemyDefinition, owner: E, scale: number) {
    const point = origin.clone(),
      radius = definition.blast * scale;
    this.ports.feedback.explosion(point, radius, INK.BLACK);
    for (const target of this.targets()) {
      const distance = target.center.distanceTo(point);
      if (target.alive && distance < radius) {
        target.takeDamage(
          definition.dmg * this.ports.damageModifier() * Math.sqrt(1 - distance / radius),
          point,
        );
        target.knockback(this.direction.subVectors(target.center, point).normalize(), 7);
      }
    }
    this.blast(point, radius, 70, owner);
  }
}
