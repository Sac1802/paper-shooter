import { Vector3 } from 'three';
import type { Body } from '../../engine/physics.js';
import { clamp, damp, rand } from '../../engine/math.js';
import type { BladeEnemyDefinition } from '../../domain/enemy-definitions.js';
import type { EnemyAttackClock } from './behavior-contracts.js';
import type { PerceivedTarget } from './perception.js';
import type { MeleeTarget, DirectedEnemyMotion } from './behavior-contracts.js';
export interface MeleeEnemyMotion extends DirectedEnemyMotion {
  approachPoint(dt: number, target: Vector3, out: Vector3): Vector3;
  meleeObstacle(dt: number): void;
}
export interface BladeActions {
  center: Vector3;
  damageModifier: () => number;
  stun(duration: number): void;
  slash(): void;
  audio: { lunge(center: Vector3): void; katanaSwing(): void };
}
/** Owns wind-up, single-hit and retreat windows; no model, manager, HUD or application context. */
export class BladeBehavior {
  private attackTime = 0;
  private hit = false;
  private retreatTime = 0;
  private readonly goal = new Vector3();
  constructor(
    private readonly definition: BladeEnemyDefinition,
    private readonly body: Body,
    private readonly motion: MeleeEnemyMotion,
    private readonly clock: EnemyAttackClock,
    private readonly actions: BladeActions,
  ) {}
  get attackT() {
    return this.attackTime;
  }
  applyAttackTime(time: number) {
    this.attackTime = time;
  }
  update(dt: number, sensed: Readonly<PerceivedTarget>, target: MeleeTarget) {
    if (this.retreatTime > 0) {
      this.retreat(dt, sensed);
      return;
    }
    if (this.attackTime > 0) {
      this.swing(dt, sensed, target);
      return;
    }
    const T = this.definition;
    if (
      sensed.distance < T.lunge &&
      Math.abs(sensed.height) < 1.7 &&
      this.clock.remaining <= 0 &&
      sensed.visible
    ) {
      this.attackTime = 0.55;
      this.hit = false;
      this.actions.audio.lunge(this.actions.center);
      this.body.vel.x += (sensed.dx / (sensed.distance || 1)) * 2.5;
      this.body.vel.z += (sensed.dz / (sensed.distance || 1)) * 2.5;
      return;
    }
    this.pursue(dt, sensed);
  }
  private retreat(dt: number, sensed: Readonly<PerceivedTarget>) {
    this.retreatTime -= dt;
    this.motion.heading = sensed.yaw;
    const force = 26 * dt,
      T = this.definition,
      body = this.body;
    body.vel.x += clamp(
      -(sensed.dx / (sensed.distance || 1)) * T.speed * 0.55 - body.vel.x,
      -force,
      force,
    );
    body.vel.z += clamp(
      -(sensed.dz / (sensed.distance || 1)) * T.speed * 0.55 - body.vel.z,
      -force,
      force,
    );
  }
  private swing(dt: number, sensed: Readonly<PerceivedTarget>, target: MeleeTarget) {
    this.attackTime -= dt;
    const body = this.body;
    body.vel.x = damp(body.vel.x, 0, 8, dt);
    body.vel.z = damp(body.vel.z, 0, 8, dt);
    this.motion.heading = sensed.yaw;
    if (this.attackTime >= 0.18 || this.hit) return;
    this.hit = true;
    this.actions.slash();
    const T = this.definition;
    if (sensed.distance < T.reach && Math.abs(sensed.height) < 1.7) {
      if (target.tryBlockMelee(this.actions)) {
        this.actions.stun(1.1);
        body.vel.set(
          -(sensed.dx / (sensed.distance || 1)) * 7,
          3.5,
          -(sensed.dz / (sensed.distance || 1)) * 7,
        );
      } else target.takeDamage(T.dmg * this.actions.damageModifier(), this.actions.center);
    } else this.actions.audio.katanaSwing();
    this.clock.remaining = rand(T.cool[0], T.cool[1]);
    this.retreatTime = rand(0.45, 0.75);
  }
  private pursue(dt: number, sensed: Readonly<PerceivedTarget>) {
    const T = this.definition,
      body = this.body;
    if (!sensed.visible || sensed.distance >= 9 || Math.abs(sensed.height) >= 1.6) {
      this.motion.follow(dt, sensed.position, T.speed);
      return;
    }
    if (sensed.distance < T.standoff && Math.abs(sensed.height) < 1.2) {
      const force = 24 * dt;
      body.vel.x += clamp(
        -(sensed.dx / (sensed.distance || 1)) * T.speed * 0.4 - body.vel.x,
        -force,
        force,
      );
      body.vel.z += clamp(
        -(sensed.dz / (sensed.distance || 1)) * T.speed * 0.4 - body.vel.z,
        -force,
        force,
      );
      this.motion.heading = sensed.yaw;
      return;
    }
    const goal =
      sensed.distance > 4.5
        ? this.motion.approachPoint(dt, sensed.position, this.goal)
        : sensed.position;
    this.motion.steer(goal.x, goal.z, T.speed, 45, dt);
    if (body.onGround && body.hitWall) this.motion.meleeObstacle(dt);
  }
}
