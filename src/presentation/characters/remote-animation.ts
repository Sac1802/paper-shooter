import type { Object3D, Vector3 } from 'three';
import { clamp, damp } from '../../engine/math.js';
import type { WalkingJoints } from './animation-contracts.js';
export interface RemoteAnimationFrame {
  velocity: Vector3;
  position: Vector3;
  onGround: boolean;
  alive: boolean;
  blade: boolean;
  aiming: boolean;
  blocking: boolean;
  pitch: number;
  sliding: boolean;
  crouching: boolean;
  localEye: Vector3 | null;
}
export interface RemoteAnimationRig {
  root: Object3D;
  joints: WalkingJoints;
  tag: Object3D;
  face: { eyes: Object3D; xeyes: Object3D } | null;
}
export function remoteAnimationFrame(velocity: Vector3, position: Vector3): RemoteAnimationFrame {
  return {
    velocity,
    position,
    onGround: true,
    alive: true,
    blade: false,
    aiming: false,
    blocking: false,
    pitch: 0,
    sliding: false,
    crouching: false,
    localEye: null,
  };
}
/** Owns remote gait and joint poses; model replacement does not reset the gait clock. */
export class RemoteAnimation {
  private walk = 0;
  private phase = 0;
  update(frame: RemoteAnimationFrame, rig: RemoteAnimationRig, dt: number) {
    const J = rig.joints;
    const sp = Math.hypot(frame.velocity.x, frame.velocity.z);
    this.walk = damp(this.walk, clamp(sp / 4, 0, 1), 10, dt);
    const w = this.walk;
    this.phase += dt * (sp * 2.2 + (sp > 0.4 ? 3 : 0));
    const s = Math.sin(this.phase),
      c = Math.cos(this.phase);
    if (!frame.alive) {
      // slumped on the page until they respawn
      rig.root.rotation.x = damp(rig.root.rotation.x, Math.PI / 2, 5, dt);
      if (rig.face) {
        rig.face.eyes.visible = false;
        rig.face.xeyes.visible = true;
      }
      return;
    }
    rig.root.rotation.x = damp(rig.root.rotation.x, 0, 8, dt);
    if (rig.face) {
      rig.face.eyes.visible = true;
      rig.face.xeyes.visible = false;
    }
    J.legL.rotation.x = s * 0.9 * w;
    J.legR.rotation.x = -s * 0.9 * w;
    J.shinL.rotation.x = Math.max(0, c) * 1.1 * w;
    J.shinR.rotation.x = Math.max(0, -c) * 1.1 * w;
    if (!frame.onGround) {
      J.legL.rotation.x = -0.5;
      J.legR.rotation.x = 0.6;
      J.shinL.rotation.x = 1.0;
      J.shinR.rotation.x = 0.5;
    }
    // guns are carried up and forward, two hands on them, tilting with where they look; the
    // blade hangs at the side until it is raised to guard
    const blade = frame.blade;
    const aim = blade ? 0 : frame.aiming ? 1 : sp > 6.5 ? 0.8 : 0.95;
    const look = clamp(frame.pitch, -1.1, 1.1);
    if (blade) {
      const g = frame.blocking ? 1 : 0;
      J.armR.rotation.x = -0.9 - g * 0.9 - s * 0.6 * w * (1 - g);
      J.armR.rotation.z = -0.3 - g * 0.5;
      J.foreR.rotation.x = -1.0 - g * 0.6;
      J.armL.rotation.x = s * 0.8 * w * (1 - g) - g * 1.4;
      J.foreL.rotation.x = -0.5;
    } else {
      J.armR.rotation.x = (-1.35 - look * 0.85) * aim - s * 0.6 * w * (1 - aim);
      J.armR.rotation.z = -0.2 * (1 - aim);
      J.foreR.rotation.x = -0.2;
      J.armL.rotation.x = (-1.25 - look * 0.85) * aim + s * 0.6 * w * (1 - aim);
      J.armL.rotation.y = 0.55 * aim;
      J.foreL.rotation.x = -0.45;
    }
    J.torso.rotation.x = -0.2 * w + (frame.sliding ? 0.5 : 0) + (frame.crouching ? 0.25 : 0);
    J.torso.rotation.y = -0.3 * aim;
    J.hips.position.y = (frame.crouching ? 0.55 : 0.86) + Math.abs(c) * 0.07 * w;
    J.headG.rotation.x = clamp(-frame.pitch, -0.7, 0.7) * 0.7;
    const localEye = frame.localEye;
    rig.tag.rotation.y =
      -rig.root.rotation.y +
      (localEye ? Math.atan2(localEye.x - frame.position.x, localEye.z - frame.position.z) : 0);
  }
}
