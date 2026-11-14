import { Vector3 } from 'three';
import { SEE_THROUGH } from '../../engine/physics.js';
import { rand } from '../../engine/math.js';
import type { VisibilityPort, TargetPose } from './queries.js';
export interface PerceivedTarget {
  position: Vector3;
  center: Vector3;
  dx: number;
  dz: number;
  distance: number;
  height: number;
  yaw: number;
  visible: boolean;
}
/** Owns line-of-sight cadence and one borrowed target frame; no combat or actor access. */
export class EnemyPerception {
  private deadline = 0;
  private readonly eye = new Vector3();
  private readonly frame: PerceivedTarget;
  constructor(
    private readonly position: Vector3,
    private readonly readEye: (out: Vector3) => Vector3,
    private readonly world: VisibilityPort,
  ) {
    this.frame = {
      position,
      center: position,
      dx: 0,
      dz: 0,
      distance: 0,
      height: 0,
      yaw: 0,
      visible: false,
    };
  }
  get visible() {
    return this.frame.visible;
  }
  update(dt: number, target: Pick<TargetPose, 'body' | 'center'>): Readonly<PerceivedTarget> {
    const frame = this.frame;
    frame.position = target.body.pos;
    frame.center = target.center;
    frame.dx = frame.position.x - this.position.x;
    frame.dz = frame.position.z - this.position.z;
    frame.distance = Math.hypot(frame.dx, frame.dz);
    frame.height = frame.position.y - this.position.y;
    this.deadline -= dt;
    if (this.deadline <= 0) {
      this.deadline = 0.12 + rand(0, 0.1);
      frame.visible = this.world.hasLineOfSight(this.readEye(this.eye), frame.center, SEE_THROUGH);
    }
    frame.yaw = Math.atan2(frame.dx, frame.dz);
    return frame;
  }
}
