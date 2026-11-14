import { clamp, damp, rand } from '../../engine/math.js';
import type { Vector3 } from 'three';
import type { Body } from '../../engine/physics.js';
import type { EnemyDefinition, RangedEnemyDefinition } from '../../domain/enemy-definitions.js';
import type { DirectedEnemyMotion } from './behavior-contracts.js';
import type { PerceivedTarget } from './perception.js';
export interface RangedEnemyMotion extends DirectedEnemyMotion {
  groundAhead(dx: number, dz: number): boolean;
}
export interface RangedAttackPort {
  shoot(dt: number, target: Vector3, targetSpeed: number): void;
  interrupt(): void;
}
export interface RangedBehaviorOptions {
  attack: RangedAttackPort;
  localSpeed: () => number;
  keepMultiplier: number;
  strafeDirection: number;
  strafeDuration: number;
}
/** Owns gun-enemy aiming, spacing and strafe decisions; attack timing and body routing are separate. */
export class RangedBehavior {
  private aim = 0;
  private strafeDirection: number;
  private strafeTime: number;
  private readonly movement = { x: 0, z: 0 };
  constructor(
    private readonly definition: RangedEnemyDefinition,
    private readonly body: Body,
    private readonly motion: RangedEnemyMotion,
    private readonly options: RangedBehaviorOptions,
  ) {
    this.strafeDirection = options.strafeDirection;
    this.strafeTime = options.strafeDuration;
  }
  get aimAmt() {
    return this.aim;
  }
  applyAim(amount: number) {
    this.aim = amount;
  }
  idle(dt: number) {
    this.body.vel.x = damp(this.body.vel.x, 0, 6, dt);
    this.body.vel.z = damp(this.body.vel.z, 0, 6, dt);
    this.aim = damp(this.aim, 0, 5, dt);
  }
  update(dt: number, target: Readonly<PerceivedTarget>, targetSpeed: number, age: number) {
    const T = this.definition;
    if (!target.visible || target.distance >= T.range) {
      this.reposition(dt, target, age);
      return;
    }
    this.aim = damp(this.aim, 1, 8, dt);
    this.motion.heading = target.yaw;
    if (!T.stationary && target.distance > T.stop * this.options.keepMultiplier) {
      this.motion.follow(dt, target.position, T.speed * 0.8);
      this.options.attack.shoot(dt, target.center, targetSpeed);
      this.motion.heading = target.yaw;
      return;
    }
    if (!T.stationary && Math.abs(target.height) > 1.2) {
      this.motion.follow(dt, target.position, T.speed * 0.85);
      // The legacy elevated-target branch used local player speed for dispersion; preserve that behavior.
      this.options.attack.shoot(dt, target.center, this.options.localSpeed());
      this.motion.heading = target.yaw;
      return;
    }
    this.chooseMovement(dt, target);
    this.move(dt);
    this.options.attack.shoot(dt, target.center, targetSpeed);
  }
  private chooseMovement(dt: number, target: Readonly<PerceivedTarget>) {
    const T = this.definition,
      nx = target.dx / (target.distance || 1),
      nz = target.dz / (target.distance || 1);
    if (T.stationary) {
      this.movement.x = 0;
      this.movement.z = 0;
      return;
    }
    if (target.distance < T.keep * this.options.keepMultiplier) {
      this.movement.x = -nx;
      this.movement.z = -nz;
      return;
    }
    if (target.distance > T.range * 0.7 && T.weapon === 'shotgun') {
      this.movement.x = nx;
      this.movement.z = nz;
      return;
    }
    this.strafeTime -= dt;
    if (this.strafeTime <= 0) {
      this.strafeTime = rand(0.8, 2);
      this.strafeDirection *= -1;
    }
    this.movement.x = -nz * this.strafeDirection;
    this.movement.z = nx * this.strafeDirection;
  }
  private move(dt: number) {
    const { x, z } = this.movement,
      T = this.definition,
      body = this.body,
      speed = T.weapon === 'shotgun' ? T.speed : T.speed * 0.5;
    if ((x || z) && this.motion.groundAhead(x, z)) {
      const force = 30 * dt;
      body.vel.x += clamp(x * speed - body.vel.x, -force, force);
      body.vel.z += clamp(z * speed - body.vel.z, -force, force);
    } else {
      body.vel.x = damp(body.vel.x, 0, 8, dt);
      body.vel.z = damp(body.vel.z, 0, 8, dt);
    }
  }
  private reposition(dt: number, target: Readonly<PerceivedTarget>, age: number) {
    const T = this.definition;
    this.aim = damp(this.aim, 0, 5, dt);
    this.options.attack.interrupt();
    if (T.stationary && age < 5) {
      this.body.vel.x = damp(this.body.vel.x, 0, 8, dt);
      this.body.vel.z = damp(this.body.vel.z, 0, 8, dt);
      this.motion.heading = target.yaw;
    } else this.motion.follow(dt, target.position, T.speed);
    if (target.visible) this.motion.heading = target.yaw;
  }
}
export function createRangedBehavior(
  definition: EnemyDefinition,
  body: Body,
  motion: RangedEnemyMotion,
  options: Omit<RangedBehaviorOptions, 'attack'> & { attack: RangedAttackPort | null },
): RangedBehavior | null {
  if (!options.attack) return null;
  if (
    definition.weapon === 'rifle' ||
    definition.weapon === 'pistol' ||
    definition.weapon === 'shotgun' ||
    definition.weapon === 'sniper'
  )
    return new RangedBehavior(definition, body, motion, { ...options, attack: options.attack });
  return null;
}
