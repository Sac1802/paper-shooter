import { Vector3 } from 'three';
import { INK } from '../../shared/ink.js';
export interface EnemyTracerPort {
  tracer(from: Vector3, to: Vector3, ink: number, width: number, life: number): void;
}
/** Reuses arc endpoints while emitting the existing five-stroke melee telegraph. */
export class EnemySlash {
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  constructor(private readonly effects: EnemyTracerPort) {}
  draw(center: Vector3, yaw: number) {
    for (let i = 0; i < 5; i++) {
      const start = -0.9 + i * 0.45,
        end = start + 0.45;
      this.from.set(
        center.x + Math.sin(yaw + start) * 1.5,
        center.y + 0.5 - i * 0.18,
        center.z + Math.cos(yaw + start) * 1.5,
      );
      this.to.set(
        center.x + Math.sin(yaw + end) * 1.5,
        center.y + 0.5 - (i + 1) * 0.18,
        center.z + Math.cos(yaw + end) * 1.5,
      );
      this.effects.tracer(this.from, this.to, INK.RED, 0.025, 0.16);
    }
  }
}
