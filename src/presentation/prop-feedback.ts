import { Vector3, type Object3D, type Scene } from 'three';
import { rand } from '../engine/math.js';
import { INK } from '../shared/ink.js';
import type { SceneResourcePort } from '../engine/ports.js';
export interface PropVisual {
  readonly group: Object3D;
  readonly pos: Vector3;
  readonly kind: string;
  readonly ink: number;
}
export interface PropEffects {
  debris(
    mesh: Object3D,
    position: Vector3,
    velocity: Vector3,
    angular: Vector3,
    options: { radius: number; blood: boolean; life: number },
  ): void;
  strokeBurst(
    point: Vector3,
    ink: number,
    count: number,
    speed: number,
    options: { life: number; size: number },
  ): void;
  explosion(point: Vector3, radius: number, ink: number): void;
  blood(point: Vector3, direction: Vector3, amount: number, options: { ink: number }): void;
  bloodPool(point: Vector3, size: number, ink: number): void;
  smoke(point: Vector3, direction: Vector3, count: number): void;
}
/** Owns prop fragment transfer and visual/sound recipes; it cannot change health or award loot. */
export class PropFeedback {
  private readonly up = new Vector3(0, 1, 0);
  constructor(
    private readonly scene: Scene,
    private readonly resources: SceneResourcePort,
    private readonly effects: PropEffects,
    private readonly audio: {
      shieldHit(point: Vector3): void;
      smash(point: Vector3, heavy: boolean): void;
    },
  ) {}
  hit(point: Vector3, ink: number) {
    this.effects.strokeBurst(point, ink, 5, 4, { life: 0.2, size: 0.03 });
    this.audio.shieldHit(point);
  }
  discard(group: Object3D) {
    this.resources.release(group);
  }
  shatter(prop: PropVisual, direction: Vector3) {
    const group = prop.group,
      point = prop.pos;
    group.updateMatrixWorld(true);
    for (const child of [...group.children]) {
      child.updateWorldMatrix(true, false);
      this.scene.attach(child);
      const velocity = direction.clone().multiplyScalar(rand(2, 6));
      velocity.x += rand(-3, 3);
      velocity.z += rand(-3, 3);
      velocity.y += rand(2.5, 6.5);
      this.effects.debris(
        child,
        child.position,
        velocity,
        new Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
        { radius: 0.14, blood: false, life: rand(6, 9) },
      );
    }
    this.resources.release(group);
    if (prop.kind === 'pinata') {
      for (const ink of [INK.PINK, INK.ORANGE, INK.GREEN])
        this.effects.strokeBurst(point, ink, 16, 7, { life: 0.7, size: 0.05 });
      this.effects.explosion(point, 2.5, INK.PINK);
    } else if (prop.kind === 'cactus') {
      this.effects.blood(point, direction, 1.4, { ink: INK.GREEN });
      this.effects.bloodPool(new Vector3(point.x, 0, point.z), 1.1, INK.GREEN);
    } else {
      this.effects.strokeBurst(point, prop.ink, 12, 5, { life: 0.35, size: 0.04 });
      this.effects.smoke(point, this.up, 3);
    }
  }
  finish(prop: PropVisual) {
    this.audio.smash(
      prop.pos,
      prop.kind === 'barrel' || prop.kind === 'crate' || prop.kind === 'cactus',
    );
  }
}
