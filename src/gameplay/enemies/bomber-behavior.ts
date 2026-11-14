import type { Body } from '../../engine/physics.js';
import { damp } from '../../engine/math.js';
import type { BomberEnemyDefinition } from '../../domain/enemy-definitions.js';
import type { PerceivedTarget } from './perception.js';
import type { DirectedEnemyMotion } from './behavior-contracts.js';
export interface BomberActions {
  flash(): void;
  fuse(): void;
  explode(): void;
}
/** Owns fuse state and pursuit decisions; population combat policy handles the explosion. */
export class BomberBehavior {
  private fuseTime = -1;
  constructor(
    private readonly definition: BomberEnemyDefinition,
    private readonly body: Body,
    private readonly motion: DirectedEnemyMotion,
    private readonly actions: BomberActions,
  ) {}
  get fuseT() {
    return this.fuseTime;
  }
  applyFuse(value: number) {
    this.fuseTime = value;
  }
  update(dt: number, target: Readonly<PerceivedTarget>) {
    const T = this.definition,
      body = this.body;
    if (this.fuseTime >= 0) {
      this.fuseTime -= dt;
      body.vel.x = damp(body.vel.x, 0, 4, dt);
      body.vel.z = damp(body.vel.z, 0, 4, dt);
      this.motion.heading = target.yaw;
      this.actions.flash();
      if (Math.floor(this.fuseTime * 8) !== Math.floor((this.fuseTime + dt) * 8))
        this.actions.fuse();
      if (this.fuseTime <= 0) this.actions.explode();
      return;
    }
    if (target.distance < T.fuseRange && Math.abs(target.height) < 2.2 && target.visible) {
      this.fuseTime = T.fuse;
      this.actions.fuse();
      return;
    }
    if (target.visible && target.distance < 12 && Math.abs(target.height) < 1.5)
      this.motion.steer(target.position.x, target.position.z, T.speed, 45, dt);
    else this.motion.follow(dt, target.position, T.speed);
  }
}
