import { clamp, damp } from '../../engine/math.js';
import type { AnimationFrame, FlyingJoints } from './animation-contracts.js';
export class FlyerAnimation {
  constructor(
    private readonly joints: FlyingJoints,
    private phase: number,
  ) {}
  update(e: AnimationFrame, dt: number) {
    const J = this.joints;
    this.phase += dt * 14;
    const flap = Math.sin(this.phase) * 0.35;
    J.wl.rotation.z = flap;
    J.wr.rotation.z = -flap;
    const roll = clamp(
      -(e.velocity.x * Math.cos(e.yaw) - e.velocity.z * Math.sin(e.yaw)) * 0.05,
      -0.8,
      0.8,
    );
    J.body.rotation.z = damp(J.body.rotation.z, roll, 6, dt);
    J.body.rotation.x = damp(J.body.rotation.x, clamp(-e.velocity.y * 0.06, -0.6, 0.6), 6, dt);
    J.body.position.y = 0.6 + Math.sin(e.time * 3) * 0.1;
    if (e.flyState === 'stunned') J.body.rotation.z += dt * 12;
  }
}
