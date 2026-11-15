import { Vector3, type Object3D, type Scene } from 'three';
import { INK } from '../../shared/ink.js';
import type { RemoteAnimationRig } from './remote-animation.js';
export interface RemoteDeathEffects {
  debris(
    mesh: Object3D,
    position: Vector3,
    velocity: Vector3,
    angularVelocity: Vector3,
    options: { radius: number; blood: boolean; life: number },
  ): void;
  blood(point: Vector3, direction: Vector3, amount: number): void;
  bloodPool(point: Vector3, size: number, ink: number): void;
}
export interface RemoteDeathPose {
  center: Vector3;
  position: Vector3;
  velocity: Vector3;
}
/** Owns remote fragmentation recipes and scene transfer; replicas retain death authority/state. */
export class RemoteRagdoll {
  private readonly impulse = new Vector3();
  private readonly extra = new Vector3();
  constructor(
    private readonly scene: Scene,
    private readonly effects: RemoteDeathEffects,
  ) {}
  perform(
    rig: Pick<RemoteAnimationRig, 'root' | 'joints' | 'face'>,
    pose: RemoteDeathPose,
    dir: Vector3 | null,
    over: boolean,
  ) {
    const J = rig.joints;
    const d = (dir && dir.lengthSq() > 0.01 ? dir.clone() : new Vector3(0, 0.4, -1)).normalize();
    if (over) {
      this.fragment(
        J.headG,
        this.extra.set((Math.random() - 0.5) * 4, 3, (Math.random() - 0.5) * 4),
        0.25,
        d,
      );
      if (Math.random() < 0.5)
        this.fragment(
          Math.random() < 0.5 ? J.armL : J.armR,
          this.extra.set((Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 6),
          0.12,
          d,
        );
    }
    // limp joints, then the body flies as one piece
    for (const k of ['armL', 'armR', 'legL', 'legR', 'foreL', 'foreR', 'shinL', 'shinR'] as const)
      if (J[k]) {
        J[k].rotation.x = (Math.random() - 0.5) * 2.4;
        J[k].rotation.z = (Math.random() - 0.5) * 1.2;
      }
    if (rig.face) {
      rig.face.eyes.visible = false;
      rig.face.xeyes.visible = true;
    }
    rig.root.updateWorldMatrix(true, false);
    this.scene.attach(rig.root);
    this.impulse.copy(d).multiplyScalar(5 + Math.random() * 3);
    this.impulse.y += 3.5 + Math.random() * 2;
    this.impulse.addScaledVector(pose.velocity, 0.4);
    this.effects.debris(
      rig.root,
      rig.root.position,
      this.impulse,
      new Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9),
      { radius: 0.55, blood: true, life: 8 },
    );
    this.effects.blood(pose.center, d, 1.3);
    this.effects.bloodPool(pose.position, 1.2 + Math.random() * 0.6, INK.RED);
  }
  private fragment(obj: Object3D | null, extraVel: Vector3, radius: number, d: Vector3) {
    if (!obj || !obj.parent) return;
    obj.updateWorldMatrix(true, false);
    this.scene.attach(obj);
    this.impulse
      .copy(d)
      .multiplyScalar(4 + Math.random() * 4)
      .add(extraVel);
    this.impulse.y += 2 + Math.random() * 3;
    this.effects.debris(
      obj,
      obj.position,
      this.impulse,
      new Vector3(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
      ),
      { radius, blood: true, life: 7 + Math.random() * 3 },
    );
  }
}
