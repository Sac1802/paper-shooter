import { Vector3 } from 'three';
import { INK } from '../../shared/ink.js';
import { TAU } from '../../engine/math.js';
export interface BossFeedbackPort {
  roar(center: Vector3): void;
  shot(center: Vector3): void;
  shake(amount: number): void;
  doodlerStomp(position: Vector3, center: Vector3): void;
  eraserRub(position: Vector3, center: Vector3): void;
  eraserWall(center: Vector3): void;
  eraserTrail(position: Vector3): void;
  inkblotSummon(center: Vector3): void;
  inkblotLand(position: Vector3, center: Vector3): void;
}
export interface BossEffectsPort {
  shakeAmt: number;
  explosion(position: Vector3, radius: number, ink: number): void;
  strokeBurst(
    position: Vector3,
    ink: number,
    count: number,
    speed: number,
    options: { life: number; size: number },
  ): void;
  bloodPool(position: Vector3, radius: number, ink: number): void;
  particle(
    kind: 'stroke',
    position: Vector3,
    velocity: Vector3,
    options: {
      size: number;
      life: number;
      ink: number;
      gravity: number;
      stretch: number;
      drag: number;
    },
  ): void;
}
export interface BossSoundPort {
  stomp(center: Vector3): void;
  bossRoar(center: Vector3): void;
  enemyShot(center: Vector3): void;
}
/** Owns feedback recipes and scratch endpoints, independently of boss decisions and damage policy. */
export class BossFeedback implements BossFeedbackPort {
  private readonly point = new Vector3();
  private readonly velocity = new Vector3();
  constructor(
    private readonly effects: BossEffectsPort,
    private readonly audio: BossSoundPort,
  ) {}
  roar(center: Vector3) {
    this.audio.bossRoar(center);
  }
  shot(center: Vector3) {
    this.audio.enemyShot(center);
  }
  shake(amount: number) {
    this.effects.shakeAmt += amount;
  }
  doodlerStomp(position: Vector3, center: Vector3) {
    this.audio.stomp(center);
    this.shake(0.9);
    this.effects.explosion(position.clone().add(this.point.set(0, 0.2, 0)), 7, INK.BLACK);
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * TAU;
      this.point.set(
        position.x + Math.cos(angle) * 3,
        position.y + 0.3,
        position.z + Math.sin(angle) * 3,
      );
      this.velocity.set(Math.cos(angle) * 14, 2, Math.sin(angle) * 14);
      this.effects.particle('stroke', this.point, this.velocity, {
        size: 0.06,
        life: 0.4,
        ink: INK.BLACK,
        gravity: 4,
        stretch: 0.06,
        drag: 3,
      });
    }
  }
  eraserRub(position: Vector3, center: Vector3) {
    this.audio.stomp(center);
    this.shake(0.8);
    this.effects.explosion(position.clone().add(this.point.set(0, 0.2, 0)), 6, INK.PINK);
  }
  eraserWall(center: Vector3) {
    this.effects.strokeBurst(center, INK.PINK, 30, 9, { life: 0.4, size: 0.05 });
    this.audio.stomp(center);
    this.shake(0.6);
  }
  eraserTrail(position: Vector3) {
    this.effects.strokeBurst(position.clone().add(this.point.set(0, 0.3, 0)), INK.PINK, 4, 3, {
      life: 0.35,
      size: 0.06,
    });
  }
  inkblotSummon(center: Vector3) {
    this.audio.bossRoar(center);
    this.effects.strokeBurst(center, INK.BLACK, 40, 10, { life: 0.5, size: 0.05 });
  }
  inkblotLand(position: Vector3, center: Vector3) {
    this.audio.stomp(center);
    this.shake(0.4);
    this.effects.bloodPool(position, 3.5, INK.BLACK);
  }
}
