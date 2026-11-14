import { Vector3 } from 'three';
import type { Body } from '../../engine/physics.js';
import { SEE_THROUGH } from '../../engine/physics.js';
import { rand } from '../../engine/math.js';
import type { RaycastPort } from '../../engine/ports.js';
import type { FlyingEnemyDefinition } from '../../domain/enemy-definitions.js';
import type { EnemyAttackClock } from './behavior-contracts.js';
import type { VisibilityPort } from './queries.js';
import type { MeleeTarget } from './behavior-contracts.js';
export interface FlyingTarget extends MeleeTarget {
  alive: boolean;
  center: Vector3;
  knockback(direction: Vector3, amount: number): void;
}
export interface FlyerPorts {
  center: Vector3;
  orientation: { heading: number };
  world: RaycastPort & VisibilityPort;
  damageModifier: () => number;
  speedModifier: () => number;
  stunned(): void;
  recovered(): void;
  audio: { flyerDive(center: Vector3): void; flyerBuzz(center: Vector3): void };
}
/** Owns aerial state, steering and dive windows for one body. */
export class FlyerBehavior {
  private mode: 'orbit' | 'dive' | 'climb' | 'stunned' = 'orbit';
  private duration: number;
  private hit = false;
  private readonly goal = new Vector3();
  private readonly direction = new Vector3();
  private readonly adjustment = new Vector3();
  private readonly down = new Vector3();
  constructor(
    private readonly definition: FlyingEnemyDefinition,
    private readonly body: Body,
    private readonly clock: EnemyAttackClock,
    private readonly ports: FlyerPorts,
    private readonly seed: { duration: number; orbitDirection: number },
  ) {
    this.duration = seed.duration;
  }
  get state() {
    return this.mode;
  }
  stun() {
    this.mode = 'stunned';
  }
  update(dt: number, target: FlyingTarget, age: number) {
    this.duration -= dt;
    this.clock.remaining -= dt;
    if (this.mode === 'stunned') this.recover(dt, age);
    else if (this.mode === 'orbit') this.orbit(dt, target, age);
    else if (this.mode === 'dive') this.dive(dt, target);
    else this.climb(dt, target);
    this.avoidGeometry(dt);
  }
  private recover(dt: number, age: number) {
    this.body.vel.y -= 20 * dt;
    if (this.body.onGround || age > 2.2) {
      this.mode = 'climb';
      this.duration = 1.2;
      this.ports.recovered();
    }
  }
  private orbit(dt: number, target: FlyingTarget, age: number) {
    const center = target.center,
      body = this.body;
    const angle =
      Math.atan2(body.pos.x - center.x, body.pos.z - center.z) + this.seed.orbitDirection * 0.45;
    this.goal.set(
      center.x + Math.sin(angle) * 11,
      center.y + 6 + Math.sin(age * 1.3) * 1.5,
      center.z + Math.cos(angle) * 11,
    );
    this.flyTo(this.goal, this.definition.speed, 22, dt);
    if (
      this.clock.remaining <= 0 &&
      target.alive &&
      this.ports.world.hasLineOfSight(this.ports.center, center, SEE_THROUGH)
    ) {
      this.mode = 'dive';
      this.duration = 1.6;
      this.hit = false;
      this.ports.audio.flyerDive(this.ports.center);
    }
    if (Math.random() < dt * 1.5) this.ports.audio.flyerBuzz(this.ports.center);
  }
  private dive(dt: number, target: FlyingTarget) {
    this.goal.copy(target.center);
    this.flyTo(this.goal, 16, 28, dt);
    const body = this.body;
    if (this.ports.center.distanceTo(target.center) < 1.4 && !this.hit) {
      this.hit = true;
      if (target.tryBlockMelee(this.ports)) {
        this.mode = 'stunned';
        this.ports.stunned();
        body.vel.set(-body.vel.x * 0.3, -3, -body.vel.z * 0.3);
      } else if (target.alive) {
        target.takeDamage(this.definition.dmg * this.ports.damageModifier(), this.ports.center);
        target.knockback(this.direction.copy(body.vel).normalize(), 3);
      }
    }
    // Preserve the existing hit/expiry transition order, including a parried dive's climb exit.
    if (this.duration <= 0 || this.hit || body.hitWall) {
      this.mode = 'climb';
      this.duration = 1.1;
      this.clock.remaining = rand(this.definition.cool[0], this.definition.cool[1]);
    }
  }
  private climb(dt: number, target: FlyingTarget) {
    const center = target.center,
      position = this.body.pos;
    this.goal.set(
      center.x + (position.x - center.x) * 1.5,
      center.y + 8,
      center.z + (position.z - center.z) * 1.5,
    );
    this.flyTo(this.goal, this.definition.speed, 18, dt);
    if (this.duration <= 0) this.mode = 'orbit';
  }
  private flyTo(target: Vector3, speed: number, acceleration: number, dt: number) {
    const body = this.body,
      direction = this.direction;
    direction.subVectors(target, body.pos);
    const distance = direction.length();
    if (distance < 0.3) {
      body.vel.multiplyScalar(Math.max(0, 1 - 4 * dt));
      return;
    }
    direction.divideScalar(distance).multiplyScalar(speed * this.ports.speedModifier());
    this.adjustment.subVectors(direction, body.vel);
    const magnitude = this.adjustment.length();
    if (magnitude > acceleration * dt)
      this.adjustment.multiplyScalar((acceleration * dt) / magnitude);
    body.vel.add(this.adjustment);
  }
  private avoidGeometry(dt: number) {
    const body = this.body,
      speed = body.vel.length();
    if (speed > 0.5) {
      this.direction.copy(body.vel).divideScalar(speed);
      const hit = this.ports.world.raycast(this.ports.center, this.direction, 3.5);
      if (hit) {
        body.vel.addScaledVector(hit.normal, 14 * dt);
        body.vel.y += 12 * dt;
      }
    }
    if (this.ports.world.raycast(this.ports.center, this.down.set(0, -1, 0), 2.5))
      body.vel.y += 12 * dt;
    this.direction.copy(body.vel);
    if (this.direction.lengthSq() > 0.1)
      this.ports.orientation.heading = Math.atan2(this.direction.x, this.direction.z);
  }
}
