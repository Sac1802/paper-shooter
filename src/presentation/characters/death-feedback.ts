import { Vector3, type Object3D, type Scene } from 'three';
import { rand } from '../../engine/math.js';
import { INK } from '../../shared/ink.js';
export interface EnemyDeathEffects {
  debris(
    object: Object3D,
    position: Vector3,
    velocity: Vector3,
    angular: Vector3,
    options: { radius: number; blood: boolean; life: number },
  ): void;
  blood(position: Vector3, direction: Vector3, amount: number, options?: { ink: number }): void;
  explosion(position: Vector3, radius: number, ink: number): void;
}
export interface EnemyDeathAudio {
  enemyDie(center: Vector3): void;
  explosion(center: Vector3): void;
}
export interface EnemyDeathFeedbackPort {
  begin(face: { eyes: Object3D; xeyes: Object3D }, telegraph: { dispose(): void }): void;
  die(center: Vector3): void;
  explosion(point: Vector3, radius: number, ink?: number): void;
  boss(center: Vector3): void;
  flyer(root: Object3D, center: Vector3, direction: Vector3, transferred: () => void): void;
}
/** Owns shared death/explosion and flying-fragment feedback, with an explicit transfer event. */
export class EnemyDeathFeedback implements EnemyDeathFeedbackPort {
  private readonly impulse = new Vector3();
  constructor(
    private readonly scene: Scene,
    private readonly effects: EnemyDeathEffects,
    private readonly audio: EnemyDeathAudio,
  ) {}
  begin(face: { eyes: Object3D; xeyes: Object3D }, telegraph: { dispose(): void }) {
    telegraph.dispose();
    face.eyes.visible = false;
    face.xeyes.visible = true;
  }
  die(center: Vector3) {
    this.audio.enemyDie(center);
  }
  explosion(point: Vector3, radius: number, ink: number = INK.BLACK) {
    this.effects.explosion(point, radius, ink);
    this.audio.explosion(point);
  }
  boss(center: Vector3) {
    this.explosion(center, 6, INK.BLACK);
  }
  flyer(root: Object3D, center: Vector3, direction: Vector3, transferred: () => void) {
    root.updateWorldMatrix(true, false);
    this.scene.attach(root);
    transferred();
    this.effects.debris(
      root,
      root.position,
      direction
        .clone()
        .multiplyScalar(4)
        .add(this.impulse.set(rand(-2, 2), 1, rand(-2, 2))),
      new Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
      { radius: 0.5, blood: true, life: 8 },
    );
    this.effects.blood(center, direction, 1);
  }
}
