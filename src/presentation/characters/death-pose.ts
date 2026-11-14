import type { Object3D } from 'three';
export interface TopplePose {
  axis: 'x' | 'z';
  sign: number;
}
/** Owns fall-over interpolation; lifetime and gameplay death remain the population's responsibility. */
export class DeathPose {
  private progress = 0;
  constructor(
    private readonly root: Object3D,
    private readonly pivot: Object3D,
    private readonly pose: TopplePose,
  ) {}
  update(dt: number, age: number, scale: number, yaw: number) {
    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + dt * 2.2);
      const angle = this.pose.sign * (Math.PI / 2) * (1 - Math.pow(1 - this.progress, 2));
      this.pivot.rotation[this.pose.axis] = angle;
    }
    if (age > 8.3) this.root.scale.setScalar(Math.max(0.001, ((9 - age) / 0.7) * scale));
    this.root.rotation.y = yaw;
  }
}
